import { Injectable } from '@angular/core';
import {
  Storage,
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from '@angular/fire/storage';
import { TaskAttachment } from '../models/task.model';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

@Injectable({
  providedIn: 'root',
})
export class TaskAttachmentService {
  constructor(private storage: Storage) {}

  /**
   * Firebase Storage にファイルをアップロードし、添付ファイル情報を返す
   */
  async uploadAttachment(
    taskId: string,
    file: File
  ): Promise<TaskAttachment> {
    if (file.size > MAX_FILE_SIZE) {
      throw new Error('ファイルサイズが5MBを超えています');
    }

    const attachmentId = this.generateId();
    const cleanFileName = file.name.replace(/\s+/g, '_');
    const storagePath = `tasks/${taskId}/attachments/${attachmentId}-${cleanFileName}`;
    const fileRef = ref(this.storage, storagePath);

    await uploadBytes(fileRef, file, {
      contentType: file.type || 'application/octet-stream',
    });

    const downloadUrl = await getDownloadURL(fileRef);

    return {
      id: attachmentId,
      name: file.name,
      url: downloadUrl,
      type: 'file',
      size: file.size,
      contentType: file.type || undefined,
      storagePath,
      uploadedAt: new Date().toISOString(),
    };
  }

  /**
   * Firebase Storage から添付ファイルを削除
   */
  async deleteAttachment(attachment: TaskAttachment): Promise<void> {
    if (!attachment.storagePath) {
      return;
    }
    const fileRef = ref(this.storage, attachment.storagePath);
    await deleteObject(fileRef);
  }

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
  }
}


