import { BaseEntity } from '../database/baseEntity';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export interface SubmissionData {
  id?: string;
  uploadedAt?: Date;
  uploadedById?: string;
  storeId?: string;
  planogramId?: string;
  uploadIds?: string[];
  bayIds?: string[];
  createdAt?: Date;
  updatedAt?: Date;
}

@Entity('submissions')
export class Submission extends BaseEntity {
  static tableName = 'submissions';

  @PrimaryGeneratedColumn('uuid')
  id: string;

 

  @Column({ name: 'uploaded_by_id' })
  uploadedById: string;

  @Column({ name: 'store_id' })
  storeId: string;

  @Column({ name: 'planogram_id' })
  planogramId: string;

  @Column({ name: 'upload_ids', type: 'json' })
  uploadIds: string[];

  @Column({ name: 'bay_ids', type: 'json', nullable: true })
  bayIds?: string[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
  @Column({ name: 'uploaded_at' })
  uploadedAt: Date;
}
