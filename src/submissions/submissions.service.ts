import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { Submission, SubmissionData } from './submission.entity';
import { Upload, UploadData } from './upload.entity';
import { Bay, BayData } from './bay.entity';
import { v4 as uuidv4 } from 'uuid';
import { User } from '../users/entities/user.entity';
import { Store } from '../store/store.entity';
import { Planogram } from '../planogram/planogram.entity';
import { StorageService } from '../storage/storage.service';

@Injectable()
export class SubmissionsService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly storageService: StorageService,
  ) {
    Submission.setDatabaseService(this.databaseService);
    Submission.setTableName('submissions');
    Upload.setDatabaseService(this.databaseService);
    Upload.setTableName('uploads');
    Bay.setDatabaseService(this.databaseService);
    Bay.setTableName('bays');
    User.setDatabaseService(this.databaseService);
    User.setTableName('users');
    Store.setDatabaseService(this.databaseService);
    Store.setTableName('stores');
    Planogram.setDatabaseService(this.databaseService);
    Planogram.setTableName('planograms');
  }

  async findAll(options: {
    filter?: Partial<SubmissionData>;
    search?: string;
    sortBy?: string;
    sortOrder?: 'ASC' | 'DESC';
  } = {}): Promise<any[]> {
    if(!options.sortBy ) {
      options.sortBy = 'uploaded_at';
    }
    if(!options.sortOrder) {
      options.sortOrder = 'DESC';
    }
    const { filter = {}, search, sortBy, sortOrder } = options;
    
    
    const searchColumns = ['id'];
    const submissions = await Submission.findAllWithSearchAndSort({
      search,
      searchColumns,
      sortBy,
      sortOrder,
      filter: filter as Record<string, any>
    }) as SubmissionData[];
    
    return this.populateSubmissionRelations(submissions);
  }

  async findById(id: string): Promise<any> {
    const submission = await Submission.findById(id) as SubmissionData;
    if (!submission) return null;
    const populatedSubmissions = await this.populateSubmissionRelations([submission]);
    return populatedSubmissions[0];
  }

  private enrichUploadWithUrls(upload: any): any {
    return {
      ...upload,
      imageSrc: this.storageService.getPublicUrl('submissions/' + upload.filename),
      imageDownloadUrl: this.storageService.getPublicUrl('submissions/' + upload.filename, true),
    };
  }

  private async populateSubmissionRelations(submissions: SubmissionData[]): Promise<any[]> {
    const populatedSubmissions: any[] = [];
    
    for (const submission of submissions as any[]) {
      const populatedSubmission: any = { ...submission };
      
      // Populate uploadedBy relation
      if (submission.uploaded_by_id) {
        try {
          const uploadedBy = await User.findById(submission.uploaded_by_id);
          populatedSubmission.uploadedBy = uploadedBy ? {
            id: uploadedBy.id,
            email: uploadedBy.email,
            firstName: uploadedBy.firstName,
            lastName: uploadedBy.lastName,
            profilePicture: uploadedBy.profilePicture,
            role: uploadedBy.role
          } : null;
        } catch (error) {
          populatedSubmission.uploadedBy = null;
        }
      }
      
      // Populate store relation
      if (submission.storeId) {
        try {
          const store = await Store.findById(submission.storeId);
          populatedSubmission.store = store ? {
            id: store.id,
            name: store.name,
            address: store.address,
            imageSrc: store.imageSrc
          } : null;
        } catch (error) {
          populatedSubmission.store = null;
        }
      }
      
      // Populate planogram relation
      if (submission.planogramId) {
        try {
          const planogram = await Planogram.findById(submission.planogramId);
          populatedSubmission.planogram = planogram ? {
            id: planogram.id,
            name: planogram.name,
            description: planogram.description,
            imageSrc: planogram.imageSrc
          } : null;
        } catch (error) {
          populatedSubmission.planogram = null;
        }
      }
      
      // Populate uploads relation
      if ((submission as any)?.upload_ids && (submission as any).upload_ids.length > 0) {
        try {
          const uploads = (await Upload.findAllByFilter({
            submissionId: submission.id,
          })) as any[];

          populatedSubmission.uploads = uploads.map((upload: any) =>
            this.enrichUploadWithUrls(upload),
          );
        } catch (error) {
          populatedSubmission.uploads = [];
        }
      } else {
        populatedSubmission.uploads = [];
      }

      // Populate bays (ordered by submission.bay_ids) with nested uploads
      const bayIds: string[] = (submission as any).bay_ids || [];
      if (bayIds.length > 0) {
        try {
          const baysOut: any[] = [];
          for (const bayId of bayIds) {
            const bayRow: any = await Bay.findById(bayId);
            if (!bayRow) continue;

            const uploadIdsInBay: string[] = bayRow.upload_ids || [];
            const bayUploads: any[] = [];
            for (const uploadId of uploadIdsInBay) {
              const u = (await Upload.findById(uploadId)) as any;
              if (u) bayUploads.push(this.enrichUploadWithUrls(u));
            }
            baysOut.push({
              ...bayRow,
              uploads: bayUploads,
            });
          }
          populatedSubmission.bays = baysOut;
        } catch (error) {
          populatedSubmission.bays = [];
        }
      } else {
        populatedSubmission.bays = [];
      }

      populatedSubmissions.push(populatedSubmission);
    }
    
    return populatedSubmissions;
  }

  async create(data: SubmissionData): Promise<SubmissionData> {
    const row = { 
      id: uuidv4(), 
      ...data, 
      uploadIds: data.uploadIds || [],
      createdAt: new Date(), 
      updatedAt: new Date() 
    } as SubmissionData;
    return Submission.create(row) as Promise<SubmissionData>;
  }

  async createWithFileUpload(
    data: SubmissionData,
    file: Express.Multer.File,
    uploadedById: string
  ): Promise<{ submission: SubmissionData; upload: UploadData; bay: BayData }> {
    // Upload file to storage first
    const uploadedFile = await this.storageService.uploadFile(file, 'submissions');
    console.log('uploadedFile', uploadedFile);
    
    // First create the upload
    const uploadData: UploadData = {
      id: uuidv4(),
      filename: uploadedFile.filename,
      filesize: file.size.toString(),
      fileType: file.mimetype,
      uploadedAt: new Date(),
      uploadedById,
      storeId: data.storeId,
      planogramId: data.planogramId,
      submissionId: '', // Will be updated after submission is created
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    // Create the submission first
    const submissionData: SubmissionData = {
      id: uuidv4(),
      uploadedAt: new Date(),
      uploadedById,
      storeId: data.storeId,
      planogramId: data.planogramId,
      uploadIds: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const submission = await this.create(submissionData);
    
    // Update upload with submission ID
    uploadData.submissionId = submission.id;
    const upload = await Upload.create(uploadData) as UploadData;

    const bayId = uuidv4();
    const bay = (await Bay.create({
      id: bayId,
      uploadIds: [upload.id],
      createdAt: new Date(),
      updatedAt: new Date(),
    })) as BayData;

    const updatedSubmission = await Submission.update(submission?.id || '', {
      uploadIds: [upload.id],
      bayIds: [bayId],
    }) as SubmissionData;

    return { submission: updatedSubmission, upload, bay };
  }

  async addUploadToSubmission(
    submissionId: string,
    uploadId: string|undefined
  ): Promise<SubmissionData> {
    if (!uploadId) {
      throw new Error('Upload ID is required');
    }
    const submission:any = await Submission.findById(submissionId) as SubmissionData;
    if (!submission) {
      throw new Error('Submission not found');
    }

    const upload = await Upload.findById(uploadId) as UploadData;
    if (!upload) {
      throw new Error('Upload not found');
    }

    // Update upload with submission ID and store/planogram IDs from submission
    console.log('submission', submission);
    await Upload.update(uploadId, { 
      submissionId,
      storeId: submission.store_id,
      planogramId: submission.planogram_id
    });

    // Update submission with new upload ID
    const updatedUploadIds = [...(submission.uploadIds || []), uploadId];
    return Submission.update(submissionId, { uploadIds: updatedUploadIds }) as Promise<SubmissionData>;
  }

  async addUploadToBayOrCreate(
    submissionId: string,
    bayId: string | undefined,
    file: Express.Multer.File,
    uploadedById: string,
  ): Promise<{ submission: SubmissionData; bay: BayData; upload: UploadData }> {
    const submission: any = (await Submission.findById(submissionId)) as SubmissionData;
    if (!submission) {
      throw new Error('Submission not found');
    }

    const upload = (await this.createUpload(
      {
        storeId: submission.store_id,
        planogramId: submission.planogram_id,
        submissionId,
      },
      file,
      uploadedById,
    )) as UploadData;

    // Keep backward compatibility: also attach the upload to the submission.
    const currentSubmissionUploadIds: string[] = submission.upload_ids || [];
    const updatedSubmissionUploadIds = Array.from(
      new Set([...(currentSubmissionUploadIds || []), upload.id]),
    );

    let updatedSubmission = (await Submission.update(submissionId, {
      uploadIds: updatedSubmissionUploadIds,
    })) as SubmissionData;

    const currentBayIds: string[] = submission.bay_ids || [];

    // Add to existing bay or create a new one.
    if (bayId) {
      if (!currentBayIds.includes(bayId)) {
        throw new Error('Bay does not belong to this submission');
      }

      const bay: any = (await Bay.findById(bayId)) as BayData;
      if (!bay) {
        throw new Error('Bay not found');
      }

      const currentBayUploadIds: string[] = bay.upload_ids || [];
      const updatedBayUploadIds = Array.from(
        new Set([...(currentBayUploadIds || []), upload.id]),
      );

      const updatedBay = (await Bay.update(bayId, {
        uploadIds: updatedBayUploadIds,
      })) as BayData;

      return { submission: updatedSubmission, bay: updatedBay, upload };
    }

    const newBayId = uuidv4();
    const newBay = (await Bay.create({
      id: newBayId,
      uploadIds: [upload.id],
      createdAt: new Date(),
      updatedAt: new Date(),
    })) as BayData;

    const updatedBayIds = Array.from(
      new Set([...(currentBayIds || []), newBayId]),
    );

    updatedSubmission = (await Submission.update(submissionId, {
      bayIds: updatedBayIds,
    })) as SubmissionData;

    return { submission: updatedSubmission, bay: newBay, upload };
  }

  async createUpload(
    data: {storeId: string, planogramId: string, submissionId: string},
    file: Express.Multer.File,
    uploadedById: string
  ): Promise<UploadData> {
    // Upload file to storage
    const uploadedFile = await this.storageService.uploadFile(file, 'submissions');
    
    // If submissionId is provided, get the submission to populate store and planogram IDs
    let storeId: string | undefined = data.storeId;
    let planogramId: string | undefined = data.planogramId;
    
    if (data.submissionId && (!storeId || !planogramId)) {
      const submission:any = await Submission.findById(data.submissionId) as SubmissionData;
      if (submission) {
        storeId = submission.store_id;
        planogramId = submission.planogram_id;
      }
    }
    // Guard against inserting empty strings into NOT NULL FKs
    if (!storeId || !planogramId) {
      throw new Error('Store ID and Planogram ID are required (provide both or a valid submissionId).');
    }
    const ensuredStoreId: string = storeId;
    const ensuredPlanogramId: string = planogramId;
    
    const uploadData: UploadData = {
      id: uuidv4(),
      filename: uploadedFile.filename,
      filesize: file.size.toString(),
      fileType: file.mimetype,
      uploadedAt: new Date(),
      uploadedById,
      storeId: ensuredStoreId,
      planogramId: ensuredPlanogramId,
      submissionId: data.submissionId || null,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    console.log('uploadData', uploadData);

    return Upload.create(uploadData) as Promise<UploadData>;
  }

  update(id: string, data: Partial<SubmissionData>): Promise<SubmissionData> {
    const row = { ...data, updatedAt: new Date() } as Partial<SubmissionData>;
    return Submission.update(id, row) as Promise<SubmissionData>;
  }

  remove(id: string): Promise<void> {
    return Submission.delete(id) as unknown as Promise<void>;
  }
}

