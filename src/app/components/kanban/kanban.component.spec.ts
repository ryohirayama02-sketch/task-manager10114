import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { KanbanComponent } from './kanban.component';
import { MemberManagementService } from '../../services/member-management.service';
import { Member } from '../../models/member.model';
import { AuthService } from '../../services/auth.service';
import { ProjectService } from '../../services/project.service';
import { ProjectSelectionService } from '../../services/project-selection.service';
import { TaskService } from '../../services/task.service';
import { LanguageService } from '../../services/language.service';
import { MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';

describe('KanbanComponent', () => {
  let component: KanbanComponent;
  let fixture: ComponentFixture<KanbanComponent>;
  let memberManagementService: jasmine.SpyObj<MemberManagementService>;
  let authService: jasmine.SpyObj<AuthService>;

  beforeEach(async () => {
    // メンバー管理サービスのモックを作成
    const memberManagementServiceSpy = jasmine.createSpyObj(
      'MemberManagementService',
      ['getMembers']
    );

    // AuthServiceのモックを作成
    const authServiceSpy = jasmine.createSpyObj('AuthService', [
      'getCurrentRoomId',
      'getCurrentRoomDocId',
    ]);
    authServiceSpy.currentUserEmail$ = of('test@example.com');
    authServiceSpy.currentRoomId$ = of('test-room-id');

    // ProjectServiceのモックを作成
    const projectServiceSpy = jasmine.createSpyObj('ProjectService', [
      'getProjects',
      'getTasksByProjectId',
    ]);
    projectServiceSpy.getProjects.and.returnValue(of([]));
    projectServiceSpy.getTasksByProjectId.and.returnValue(of([]));

    // ProjectSelectionServiceのモックを作成
    const projectSelectionServiceSpy = jasmine.createSpyObj(
      'ProjectSelectionService',
      ['getSelectedProjectIds', 'getSelectedProjectIdsSync']
    );
    projectSelectionServiceSpy.getSelectedProjectIds.and.returnValue(of([]));
    projectSelectionServiceSpy.getSelectedProjectIdsSync.and.returnValue([]);

    // TaskServiceのモックを作成
    const taskServiceSpy = jasmine.createSpyObj('TaskService', [
      'updateTaskStatus',
    ]);

    // LanguageServiceのモックを作成
    const languageServiceSpy = jasmine.createSpyObj('LanguageService', [
      'translate',
      'translateWithParams',
    ]);
    languageServiceSpy.translate.and.returnValue('');

    // MatDialogのモックを作成
    const matDialogSpy = jasmine.createSpyObj('MatDialog', ['open']);

    // Routerのモックを作成
    const routerSpy = jasmine.createSpyObj('Router', ['navigate']);
    routerSpy.url = '/kanban';

    // MatSnackBarのモックを作成
    const matSnackBarSpy = jasmine.createSpyObj('MatSnackBar', ['open']);

    await TestBed.configureTestingModule({
      imports: [KanbanComponent],
      providers: [
        { provide: MemberManagementService, useValue: memberManagementServiceSpy },
        { provide: AuthService, useValue: authServiceSpy },
        { provide: ProjectService, useValue: projectServiceSpy },
        { provide: ProjectSelectionService, useValue: projectSelectionServiceSpy },
        { provide: TaskService, useValue: taskServiceSpy },
        { provide: LanguageService, useValue: languageServiceSpy },
        { provide: MatDialog, useValue: matDialogSpy },
        { provide: Router, useValue: routerSpy },
        { provide: MatSnackBar, useValue: matSnackBarSpy },
      ],
    }).compileComponents();

    memberManagementService = TestBed.inject(
      MemberManagementService
    ) as jasmine.SpyObj<MemberManagementService>;
    authService = TestBed.inject(AuthService) as jasmine.SpyObj<AuthService>;

    fixture = TestBed.createComponent(KanbanComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('担当者フィルター', () => {
    it('カンバン画面の担当者フィルターで選べる数が、メンバー管理の数と一致する', () => {
      // テストデータ：メンバー管理に登録されているメンバー
      const mockMembers: Member[] = [
        { id: '1', name: '山田太郎', email: 'yamada@example.com' },
        { id: '2', name: '佐藤花子', email: 'sato@example.com' },
        { id: '3', name: '鈴木一郎', email: 'suzuki@example.com' },
        { id: '4', name: '田中次郎', email: 'tanaka@example.com' },
      ];

      // メンバー管理サービスのモックを設定
      memberManagementService.getMembers.and.returnValue(of(mockMembers));

      // コンポーネントを再初期化してメンバーを読み込む
      component.ngOnInit();
      fixture.detectChanges();

      // 担当者フィルターで選べる数を取得
      const assigneeOptions = component.getUniqueAssignees();

      // メンバー管理の数と一致することを確認
      expect(assigneeOptions.length).toBe(mockMembers.length);
      expect(assigneeOptions).toEqual(
        mockMembers.map((m) => m.name).sort()
      );
    });

    it('カンマ区切りのメンバー名が正しく分割される', () => {
      // テストデータ：カンマ区切りのメンバー名を含むメンバー
      const mockMembers: Member[] = [
        { id: '1', name: '山田太郎, 山田花子', email: 'yamada@example.com' },
        { id: '2', name: '佐藤花子', email: 'sato@example.com' },
        { id: '3', name: '鈴木一郎, 鈴木次郎, 鈴木三郎', email: 'suzuki@example.com' },
      ];

      // メンバー管理サービスのモックを設定
      memberManagementService.getMembers.and.returnValue(of(mockMembers));

      // コンポーネントを再初期化してメンバーを読み込む
      component.ngOnInit();
      fixture.detectChanges();

      // 担当者フィルターで選べる数を取得
      const assigneeOptions = component.getUniqueAssignees();

      // カンマ区切りで分割されたメンバー名の数を確認
      // 山田太郎, 山田花子 (2つ) + 佐藤花子 (1つ) + 鈴木一郎, 鈴木次郎, 鈴木三郎 (3つ) = 6つ
      const expectedNames = [
        '佐藤花子',
        '山田太郎',
        '山田花子',
        '鈴木一郎',
        '鈴木次郎',
        '鈴木三郎',
      ].sort();

      expect(assigneeOptions.length).toBe(6);
      expect(assigneeOptions).toEqual(expectedNames);
    });

    it('メンバーが0件の場合、担当者フィルターも0件になる', () => {
      // テストデータ：メンバーが0件
      const mockMembers: Member[] = [];

      // メンバー管理サービスのモックを設定
      memberManagementService.getMembers.and.returnValue(of(mockMembers));

      // コンポーネントを再初期化してメンバーを読み込む
      component.ngOnInit();
      fixture.detectChanges();

      // 担当者フィルターで選べる数を取得
      const assigneeOptions = component.getUniqueAssignees();

      // メンバー管理の数と一致することを確認
      expect(assigneeOptions.length).toBe(0);
      expect(assigneeOptions).toEqual([]);
    });

    it('名前が空のメンバーは除外される', () => {
      // テストデータ：名前が空のメンバーを含む
      const mockMembers: Member[] = [
        { id: '1', name: '山田太郎', email: 'yamada@example.com' },
        { id: '2', name: '', email: 'empty@example.com' },
        { id: '3', name: '   ', email: 'whitespace@example.com' },
        { id: '4', name: '佐藤花子', email: 'sato@example.com' },
      ];

      // メンバー管理サービスのモックを設定
      memberManagementService.getMembers.and.returnValue(of(mockMembers));

      // コンポーネントを再初期化してメンバーを読み込む
      component.ngOnInit();
      fixture.detectChanges();

      // 担当者フィルターで選べる数を取得
      const assigneeOptions = component.getUniqueAssignees();

      // 名前が空のメンバーは除外されることを確認
      expect(assigneeOptions.length).toBe(2);
      expect(assigneeOptions).toEqual(['佐藤花子', '山田太郎'].sort());
    });
  });
});
