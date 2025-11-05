import { Injectable } from '@angular/core';
import {
  Storage,
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from '@angular/fire/storage';
import { ProjectAttachment } from '../models/project.model';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

@Injectable({
  providedIn: 'root',
})
export class ProjectAttachmentService {
  constructor(private storage: Storage) {}

  /**
   * Firebase Storage にファイルをアップロードし、添付ファイル情報を返す
   */
  async uploadAttachment(
    projectId: string,
    file: File
  ): Promise<ProjectAttachment> {
    console.log(`[uploadAttachment] Starting upload for file: ${file.name}`);

    // Storage インスタンスが存在するか確認
    if (!this.storage) {
      throw new Error(
        '[uploadAttachment] Storage is not initialized. Check provideStorage() configuration in main.ts'
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      throw new Error('ファイルサイズが5MBを超えています');
    }

    const attachmentId = this.generateId();
    const cleanFileName = file.name.replace(/\s+/g, '_');
    const storagePath = `projects/${projectId}/attachments/${attachmentId}-${cleanFileName}`;

    console.log(`[uploadAttachment] Storage path: ${storagePath}`);
    console.log(`[uploadAttachment] File size: ${file.size} bytes`);
    console.log(
      `[uploadAttachment] File type: ${file.type || 'not specified'}`
    );

    try {
      const fileRef = ref(this.storage, storagePath);

      // contentType を安全に処理
      const contentType =
        file.type && file.type.trim() !== ''
          ? file.type
          : 'application/octet-stream';

      console.log(`[uploadAttachment] Resolved contentType: ${contentType}`);
      console.log(`[uploadAttachment] Starting uploadBytes...`);

      // uploadBytes の実行
      const uploadTask = uploadBytes(fileRef, file, { contentType });
      console.log(`[uploadAttachment] uploadBytes promise created`);

      await uploadTask;
      console.log(`[uploadAttachment] uploadBytes completed successfully`);

      // getDownloadURL の実行
      console.log(`[uploadAttachment] Starting getDownloadURL...`);
      const downloadUrl = await getDownloadURL(fileRef);
      console.log(
        `[uploadAttachment] getDownloadURL completed: ${downloadUrl.substring(
          0,
          50
        )}...`
      );

      const result: ProjectAttachment = {
        id: attachmentId,
        name: file.name,
        url: downloadUrl,
        type: 'file',
        size: file.size,
        contentType: file.type || undefined,
        storagePath,
        uploadedAt: new Date().toISOString(),
      };

      console.log(
        `[uploadAttachment] Upload successful, returning attachment info`
      );
      return result;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error(
        `[uploadAttachment] Error occurred: ${errorMessage}`,
        error
      );

      if (errorMessage.includes('Permission denied')) {
        throw new Error(
          'Firebase Storage へのアクセス権限がありません。ログイン状態を確認してください。\n' +
            'セキュリティルールを確認: ' +
            'rules_version = "2";\n' +
            'service firebase.storage {\n' +
            '  match /b/{bucket}/o {\n' +
            '    match /projects/{projectId}/{allPaths=**} {\n' +
            '      allow write: if request.auth != null;\n' +
            '    }\n' +
            '  }\n' +
            '}'
        );
      } else if (errorMessage.includes('UNAUTHENTICATED')) {
        throw new Error(
          'Firebase Storage にアクセスするには、ログインが必要です。現在ログイン状態ですか？'
        );
      }

      throw error;
    }
  }

  /**
   * Firebase Storage から添付ファイルを削除
   */
  async deleteAttachment(attachment: ProjectAttachment): Promise<void> {
    if (!attachment.storagePath) {
      return;
    }

    console.log(`[deleteAttachment] Deleting: ${attachment.storagePath}`);

    try {
      const fileRef = ref(this.storage, attachment.storagePath);
      await deleteObject(fileRef);
      console.log(
        `[deleteAttachment] Successfully deleted: ${attachment.storagePath}`
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error(
        `[deleteAttachment] Error occurred: ${errorMessage}`,
        error
      );
      throw error;
    }
  }

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
  }
}
