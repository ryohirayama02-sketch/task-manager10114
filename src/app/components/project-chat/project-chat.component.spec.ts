import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ProjectChatComponent } from './project-chat.component';

describe('ProjectChatComponent', () => {
  let component: ProjectChatComponent;
  let fixture: ComponentFixture<ProjectChatComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProjectChatComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ProjectChatComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

