import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
  Req,
  UseInterceptors,
  UploadedFile,
  Query,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags, ApiBody, ApiParam, ApiQuery, ApiConsumes } from '@nestjs/swagger';
import { SubmissionsService } from './submissions.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CreateSubmissionDto } from './dto/create-submission.dto';
import { UpdateSubmissionDto } from './dto/update-submission.dto';
import { AddUploadToSubmissionDto } from './dto/add-upload-to-submission.dto';
import { AddUploadToBayDto } from './dto/add-upload-to-bay.dto';
import { UploadData } from './upload.entity';

@ApiTags('submissions')
@Controller('submissions')
export class SubmissionsController {
  constructor(private readonly submissionsService: SubmissionsService) {}

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles('ADMIN')
  @ApiOperation({ summary: 'List submissions with search and sort options (admin only)' })
  @ApiQuery({ name: 'storeId', required: false, type: String, description: 'Filter by store ID' })
  @ApiQuery({ name: 'planogramId', required: false, type: String, description: 'Filter by planogram ID' })
  @ApiQuery({ name: 'uploadedById', required: false, type: String, description: 'Filter by uploaded by user ID' })
  @ApiQuery({ name: 'search', required: false, type: String, description: 'Search in submission fields' })
  @ApiQuery({ name: 'sortBy', required: false, type: String, description: 'Sort by field (uploadedAt, createdAt, updatedAt)' })
  @ApiQuery({ name: 'sortOrder', required: false, enum: ['ASC', 'DESC'], description: 'Sort order' })
  async findAll(@Query() query: any) {
    const { storeId, planogramId, uploadedById, search, sortBy, sortOrder } = query;
    return this.submissionsService.findAll({
      filter: { storeId, planogramId, uploadedById },
      search,
      sortBy,
      sortOrder
    });
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Get submission by id (admin only)' })
  @ApiParam({ name: 'id', type: String })
  async findOne(@Param('id') id: string) {
    return this.submissionsService.findById(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles('USER', 'ADMIN')
  @ApiOperation({ summary: 'Create submission with file upload' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  @ApiBody({
    description: 'Create submission with file upload',
    schema: {
      type: 'object',
      properties: {
        storeId: { type: 'string', format: 'uuid' },
        planogramId: { type: 'string', format: 'uuid' },
        file: { type: 'string', format: 'binary' }
      },
      required: ['storeId', 'planogramId', 'file']
    }
  })
  async createWithFileUpload(
    @Req() req,
    @Body() body: { storeId: string; planogramId: string },
    @UploadedFile() file: Express.Multer.File
  ) {
    const payload = { 
      storeId: body.storeId, 
      planogramId: body.planogramId,
      uploadedById: req.user?.id 
    };
    return this.submissionsService.createWithFileUpload(payload, file, req.user?.id);
  }

  @Post(':id/uploads')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles('USER', 'ADMIN')
  @ApiOperation({ summary: 'Add upload to existing submission' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  @ApiParam({ name: 'id', type: String })
  @ApiBody({
    description: 'Add file upload to submission',
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' }
      },
      required: ['file']
    }
  })
  async addUploadToSubmission(
    @Param('id') submissionId: string,
    @Req() req,
    @UploadedFile() file: Express.Multer.File
  ) {
    // First create the upload
    const uploadData= {
      storeId: '', // Will be populated from submission
      planogramId: '', // Will be populated from submission
      submissionId: submissionId
    };

    const upload = await this.submissionsService.createUpload(
      uploadData,
      file,
      req.user?.id
    );

    // Then add it to the submission
    return this.submissionsService.addUploadToSubmission(submissionId, upload?.id);
  }

  @Post(':id/bays/uploads')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles('USER', 'ADMIN')
  @ApiOperation({ summary: 'Add upload to a bay (or create bay) within a submission' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  @ApiParam({ name: 'id', type: String })
  @ApiBody({
    description: 'Add file upload to a bay. Provide bayId to attach to an existing bay, or omit to create a new bay.',
    schema: {
      type: 'object',
      properties: {
        bayId: { type: 'string', format: 'uuid' },
        file: { type: 'string', format: 'binary' },
      },
      required: ['file'],
    },
  })
  async addUploadToBayOrCreate(
    @Param('id') submissionId: string,
    @Body() body: AddUploadToBayDto,
    @Req() req,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.submissionsService.addUploadToBayOrCreate(
      submissionId,
      body?.bayId,
      file,
      req.user?.id,
    );
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Update submission (admin only)' })
  @ApiParam({ name: 'id', type: String })
  @ApiBody({ type: UpdateSubmissionDto })
  async update(@Param('id') id: string, @Req() req, @Body() body: UpdateSubmissionDto) {
    const payload = { ...body, updatedById: req.user?.id } as any;
    return this.submissionsService.update(id, payload);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Delete submission (admin only)' })
  @ApiParam({ name: 'id', type: String })
  async remove(@Param('id') id: string) {
    return this.submissionsService.remove(id);
  }
}
