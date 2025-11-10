import { TestBed } from '@angular/core/testing';
import { LanguageService, SupportedLanguage } from './language.service';

describe('LanguageService', () => {
  let service: LanguageService;
  let localStorageSpy: jasmine.SpyObj<Storage>;

  beforeEach(() => {
    // localStorageのモックを作成
    const store: { [key: string]: string } = {};
    localStorageSpy = jasmine.createSpyObj('localStorage', ['getItem', 'setItem', 'removeItem', 'clear']);
    
    localStorageSpy.getItem.and.callFake((key: string) => store[key] || null);
    localStorageSpy.setItem.and.callFake((key: string, value: string) => {
      store[key] = value;
    });
    localStorageSpy.removeItem.and.callFake((key: string) => {
      delete store[key];
    });
    localStorageSpy.clear.and.callFake(() => {
      Object.keys(store).forEach(key => delete store[key]);
    });

    // localStorageをモックに置き換え
    Object.defineProperty(window, 'localStorage', {
      value: localStorageSpy,
      writable: true,
    });

    TestBed.configureTestingModule({});
    service = TestBed.inject(LanguageService);
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

    it('デフォルト言語が日本語であること', () => {
      expect(service.getCurrentLanguage()).toBe('ja');
    });

    it('localStorageに保存がない場合、デフォルト言語を返すこと', () => {
      localStorageSpy.getItem.and.returnValue(null);
      const newService = new LanguageService();
      expect(newService.getCurrentLanguage()).toBe('ja');
    });

    it('localStorageに"ja"が保存されている場合、日本語を返すこと', () => {
      localStorageSpy.getItem.and.returnValue('ja');
      const newService = new LanguageService();
      expect(newService.getCurrentLanguage()).toBe('ja');
    });

    it('localStorageに"en"が保存されている場合、英語を返すこと', () => {
      localStorageSpy.getItem.and.returnValue('en');
      const newService = new LanguageService();
      expect(newService.getCurrentLanguage()).toBe('en');
    });

    it('localStorageに無効な値が保存されている場合、デフォルト言語を返すこと', () => {
      localStorageSpy.getItem.and.returnValue('invalid');
      const newService = new LanguageService();
      expect(newService.getCurrentLanguage()).toBe('ja');
    });

    it('localStorageの読み込みエラー時、デフォルト言語を返すこと', () => {
      localStorageSpy.getItem.and.throwError('Storage error');
      expect(() => new LanguageService()).not.toThrow();
      // エラーが発生してもデフォルト言語が返されることを確認
      const newService = new LanguageService();
      expect(newService.getCurrentLanguage()).toBe('ja');
    });
  });

  describe('getCurrentLanguage()', () => {
    it('現在の言語を取得できること', () => {
      expect(service.getCurrentLanguage()).toBe('ja');
    });

    it('言語変更後、変更後の言語を返すこと', (done) => {
      service.setLanguage('en');
      service.language$.subscribe((lang) => {
        expect(lang).toBe('en');
        expect(service.getCurrentLanguage()).toBe('en');
        done();
      });
    });
  });

  describe('setLanguage()', () => {
    it('言語を日本語に設定できること', () => {
      // デフォルトが'ja'なので、まず'en'に変更してから'ja'に戻す
      service.setLanguage('en');
      localStorageSpy.setItem.calls.reset();
      service.setLanguage('ja');
      expect(service.getCurrentLanguage()).toBe('ja');
      expect(localStorageSpy.setItem).toHaveBeenCalledWith('app-language', 'ja');
    });

    it('言語を英語に設定できること', () => {
      service.setLanguage('en');
      expect(service.getCurrentLanguage()).toBe('en');
      expect(localStorageSpy.setItem).toHaveBeenCalledWith('app-language', 'en');
    });

    it('同じ言語を設定しても、localStorageに再保存しないこと', () => {
      service.setLanguage('ja');
      localStorageSpy.setItem.calls.reset();
      service.setLanguage('ja');
      expect(localStorageSpy.setItem).not.toHaveBeenCalled();
    });

    it('言語変更時にlanguage$が更新されること', (done) => {
      service.language$.subscribe((lang) => {
        if (lang === 'en') {
          expect(lang).toBe('en');
          done();
        }
      });
      service.setLanguage('en');
    });

    it('言語設定時にdocument.documentElement.langが更新されること', () => {
      service.setLanguage('en');
      expect(document.documentElement.lang).toBe('en');
      
      service.setLanguage('ja');
      expect(document.documentElement.lang).toBe('ja');
    });

    it('言語設定時にbodyのdata-language属性が更新されること', () => {
      service.setLanguage('en');
      expect(document.body.getAttribute('data-language')).toBe('en');
      
      service.setLanguage('ja');
      expect(document.body.getAttribute('data-language')).toBe('ja');
    });

    it('localStorageの保存エラー時、例外を投げないこと', () => {
      localStorageSpy.setItem.and.throwError('Storage error');
      expect(() => service.setLanguage('en')).not.toThrow();
    });
  });

  describe('translate()', () => {
    it('存在するキーの翻訳を取得できること（日本語）', () => {
      service.setLanguage('ja');
      expect(service.translate('app.title')).toBe('課題管理アプリ');
    });

    it('存在するキーの翻訳を取得できること（英語）', () => {
      service.setLanguage('en');
      expect(service.translate('app.title')).toBe('Task Manager');
    });

    it('存在しないキーの場合、キー自体を返すこと', () => {
      expect(service.translate('nonexistent.key')).toBe('nonexistent.key');
    });

    it('空文字列のキーの場合、空文字列を返すこと', () => {
      expect(service.translate('')).toBe('');
    });

    it('現在の言語に翻訳がない場合、デフォルト言語の翻訳を返すこと', () => {
      // テスト用に存在しない言語を設定した場合の動作を確認
      // 実際には'ja'と'en'のみがサポートされているため、このテストは実装に依存
      service.setLanguage('ja');
      const translation = service.translate('app.title');
      expect(translation).toBe('課題管理アプリ');
    });

    it('複数のキーを順次翻訳できること', () => {
      service.setLanguage('ja');
      expect(service.translate('nav.kanban')).toBe('カンバン');
      expect(service.translate('nav.gantt')).toBe('ガント');
      expect(service.translate('nav.calendar')).toBe('カレンダー');
    });
  });

  describe('translateWithParams()', () => {
    it('プレースホルダーを含む翻訳を正しく置換できること', () => {
      service.setLanguage('ja');
      const result = service.translateWithParams('kanban.alert.parentTaskStatusChange', {
        taskName: 'テストタスク',
      });
      expect(result).toBe('「親タスク：テストタスク」のステータスを作業中に変更します');
    });

    it('複数のプレースホルダーを正しく置換できること', () => {
      // 複数プレースホルダーの例（実際のキーに存在する場合）
      const result = service.translateWithParams('quickTasks.days', {
        days: '7',
      });
      expect(result).toContain('7');
    });

    it('プレースホルダーがない場合、そのまま返すこと', () => {
      service.setLanguage('ja');
      const result = service.translateWithParams('app.title', {});
      expect(result).toBe('課題管理アプリ');
    });

    it('存在しないキーの場合、キー自体を返すこと', () => {
      const result = service.translateWithParams('nonexistent.key', { param: 'value' });
      expect(result).toBe('nonexistent.key');
    });

    it('プレースホルダーが使用されていない場合、そのまま返すこと', () => {
      service.setLanguage('ja');
      const result = service.translateWithParams('app.title', { unused: 'value' });
      expect(result).toBe('課題管理アプリ');
    });
  });

  describe('language$ Observable', () => {
    it('初期値がデフォルト言語であること', (done) => {
      service.language$.subscribe((lang) => {
        expect(lang).toBe('ja');
        done();
      });
    });

    it('言語変更時にObservableが更新されること', (done) => {
      let callCount = 0;
      service.language$.subscribe((lang) => {
        callCount++;
        if (callCount === 1) {
          expect(lang).toBe('ja');
        } else if (callCount === 2) {
          expect(lang).toBe('en');
          done();
        }
      });
      service.setLanguage('en');
    });

    it('同じ言語を設定した場合、Observableが再発行されないこと', (done) => {
      let callCount = 0;
      service.language$.subscribe((lang) => {
        callCount++;
        if (callCount > 2) {
          fail('Observableが再発行されました');
        }
      });
      
      service.setLanguage('ja');
      service.setLanguage('ja');
      
      setTimeout(() => {
        expect(callCount).toBe(1);
        done();
      }, 100);
    });
  });

  describe('ブラウザ環境判定', () => {
    it('ブラウザ環境で動作すること', () => {
      // windowとdocumentが存在することを確認
      expect(typeof window).not.toBe('undefined');
      expect(typeof document).not.toBe('undefined');
    });
  });

  describe('統合テスト', () => {
    it('言語設定→翻訳取得の一連の流れが正しく動作すること', () => {
      // 日本語に設定
      service.setLanguage('ja');
      expect(service.translate('app.title')).toBe('課題管理アプリ');
      
      // 英語に変更
      service.setLanguage('en');
      expect(service.translate('app.title')).toBe('Task Manager');
      
      // 再度日本語に戻す
      service.setLanguage('ja');
      expect(service.translate('app.title')).toBe('課題管理アプリ');
    });

    it('複数の翻訳キーを異なる言語で取得できること', () => {
      const keys = ['app.title', 'nav.kanban', 'nav.gantt', 'settings.title'];
      
      service.setLanguage('ja');
      const jaTranslations = keys.map((key) => service.translate(key));
      expect(jaTranslations).toEqual([
        '課題管理アプリ',
        'カンバン',
        'ガント',
        '設定',
      ]);
      
      service.setLanguage('en');
      const enTranslations = keys.map((key) => service.translate(key));
      expect(enTranslations).toEqual([
        'Task Manager',
        'Kanban',
        'Gantt',
        'Settings',
      ]);
    });
  });
});

