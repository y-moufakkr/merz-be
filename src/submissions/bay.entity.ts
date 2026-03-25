import { BaseEntity } from '../database/baseEntity';
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export interface BayData {
  id?: string;
  uploadIds?: string[];
  createdAt?: Date;
  updatedAt?: Date;
}

@Entity('bays')
export class Bay extends BaseEntity {
  static tableName = 'bays';

  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Stores the upload IDs that belong to this bay.
  // Kept as JSON because the rest of the codebase already uses JSON arrays for `Submission.uploadIds`.
  @Column({ name: 'upload_ids', type: 'json', nullable: true })
  uploadIds?: string[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

