import { TestBed } from '@angular/core/testing';
import { ProjectSelectionService } from './project-selection.service';

describe('ProjectSelectionService', () => {
  let service: ProjectSelectionService;
  let localStorageSpy: jasmine.SpyObj<Storage>;

  beforeEach(() => {
    // localStorageのモックを作成
    const store: { [key: string]: string } = {};
    localStorageSpy = jasmine.createSpyObj('localStorage', [
      'getItem',
      'setItem',
      'removeItem',
      'clear',
    ]);

    localStorageSpy.getItem.and.callFake((key: string) => store[key] || null);
    localStorageSpy.setItem.and.callFake((key: string, value: string) => {
      store[key] = value;
    });
    localStorageSpy.removeItem.and.callFake((key: string) => {
      delete store[key];
    });
    localStorageSpy.clear.and.callFake(() => {
      Object.keys(store).forEach((key) => delete store[key]);
    });

    // localStorageをモックに置き換え
    Object.defineProperty(window, 'localStorage', {
      value: localStorageSpy,
      writable: true,
    });

    TestBed.configureTestingModule({});
    service = TestBed.inject(ProjectSelectionService);
  });

  afterEach(() => {
    // テスト後にlocalStorageをクリア
    if (localStorageSpy.clear) {
      localStorageSpy.clear();
    }
  });

  describe('初期化', () => {
    it('should be created', () => {
      expect(service).toBeTruthy();
    });

    it('localStorageに保存がない場合、空配列を返すこと', () => {
      localStorageSpy.getItem.and.returnValue(null);
      const newService = new ProjectSelectionService();
      expect(newService.getSelectedProjectIdsSync()).toEqual([]);
    });

    it('localStorageに保存がある場合、その値を返すこと', () => {
      const savedIds = ['project1', 'project2'];
      localStorageSpy.getItem.and.returnValue(JSON.stringify(savedIds));
      const newService = new ProjectSelectionService();
      expect(newService.getSelectedProjectIdsSync()).toEqual(savedIds);
    });

    it('localStorageに無効なJSONが保存されている場合、空配列を返すこと', () => {
      localStorageSpy.getItem.and.returnValue('invalid json');
      spyOn(console, 'error'); // console.errorの出力を抑制
      const newService = new ProjectSelectionService();
      expect(newService.getSelectedProjectIdsSync()).toEqual([]);
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe('getSelectedProjectIds()', () => {
    it('Observableを返すこと', () => {
      const result = service.getSelectedProjectIds();
      expect(result).toBeDefined();
      expect(typeof result.subscribe).toBe('function');
    });

    it('初期値が空配列であること', (done) => {
      service.getSelectedProjectIds().subscribe((ids) => {
        expect(ids).toEqual([]);
        done();
      });
    });

    it('選択されたプロジェクトIDを取得できること', (done) => {
      service.setSelectedProjectIds(['project1', 'project2']);
      service.getSelectedProjectIds().subscribe((ids) => {
        expect(ids).toEqual(['project1', 'project2']);
        done();
      });
    });
  });

  describe('getSelectedProjectIdsSync()', () => {
    it('現在の選択されたプロジェクトIDを同期的に取得できること', () => {
      expect(service.getSelectedProjectIdsSync()).toEqual([]);
      service.setSelectedProjectIds(['project1']);
      expect(service.getSelectedProjectIdsSync()).toEqual(['project1']);
    });
  });

  describe('setSelectedProjectIds()', () => {
    it('プロジェクトIDを設定できること', () => {
      const projectIds = ['project1', 'project2'];
      service.setSelectedProjectIds(projectIds);
      expect(service.getSelectedProjectIdsSync()).toEqual(projectIds);
      expect(localStorageSpy.setItem).toHaveBeenCalledWith(
        'selectedProjectIds',
        JSON.stringify(projectIds)
      );
    });

    it('空配列を設定できること', () => {
      service.setSelectedProjectIds(['project1']);
      service.setSelectedProjectIds([]);
      expect(service.getSelectedProjectIdsSync()).toEqual([]);
      expect(localStorageSpy.setItem).toHaveBeenCalledWith(
        'selectedProjectIds',
        JSON.stringify([])
      );
    });

    it('localStorageの保存エラー時、例外を投げないこと', () => {
      localStorageSpy.setItem.and.throwError('Storage error');
      spyOn(console, 'error'); // console.errorの出力を抑制
      expect(() => service.setSelectedProjectIds(['project1'])).not.toThrow();
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe('toggleProjectSelection()', () => {
    it('未選択のプロジェクトIDを選択できること', () => {
      service.toggleProjectSelection('project1');
      expect(service.getSelectedProjectIdsSync()).toContain('project1');
    });

    it('選択済みのプロジェクトIDを解除できること', () => {
      service.setSelectedProjectIds(['project1', 'project2']);
      service.toggleProjectSelection('project1');
      expect(service.getSelectedProjectIdsSync()).not.toContain('project1');
      expect(service.getSelectedProjectIdsSync()).toContain('project2');
    });

    it('複数のプロジェクトIDをトグルできること', () => {
      service.toggleProjectSelection('project1');
      service.toggleProjectSelection('project2');
      expect(service.getSelectedProjectIdsSync()).toEqual([
        'project1',
        'project2',
      ]);
      service.toggleProjectSelection('project1');
      expect(service.getSelectedProjectIdsSync()).toEqual(['project2']);
    });
  });

  describe('clearSelection()', () => {
    it('選択をクリアできること', () => {
      service.setSelectedProjectIds(['project1', 'project2']);
      service.clearSelection();
      expect(service.getSelectedProjectIdsSync()).toEqual([]);
      expect(localStorageSpy.setItem).toHaveBeenCalledWith(
        'selectedProjectIds',
        JSON.stringify([])
      );
    });
  });

  describe('統合テスト', () => {
    it('選択→トグル→クリアの一連の流れが正しく動作すること', () => {
      // 選択
      service.setSelectedProjectIds(['project1', 'project2']);
      expect(service.getSelectedProjectIdsSync()).toEqual([
        'project1',
        'project2',
      ]);

      // トグル（project1を解除）
      service.toggleProjectSelection('project1');
      expect(service.getSelectedProjectIdsSync()).toEqual(['project2']);

      // トグル（project3を追加）
      service.toggleProjectSelection('project3');
      expect(service.getSelectedProjectIdsSync()).toEqual(['project2', 'project3']);

      // クリア
      service.clearSelection();
      expect(service.getSelectedProjectIdsSync()).toEqual([]);
    });

    it('localStorageから復元→変更→保存の流れが正しく動作すること', () => {
      // localStorageに保存
      const savedIds = ['project1', 'project2'];
      localStorageSpy.getItem.and.returnValue(JSON.stringify(savedIds));

      // 新しいサービスインスタンスを作成（localStorageから復元）
      const newService = new ProjectSelectionService();
      expect(newService.getSelectedProjectIdsSync()).toEqual(savedIds);

      // 変更
      newService.setSelectedProjectIds(['project3']);
      expect(newService.getSelectedProjectIdsSync()).toEqual(['project3']);
      expect(localStorageSpy.setItem).toHaveBeenCalledWith(
        'selectedProjectIds',
        JSON.stringify(['project3'])
      );
    });
  });
});

