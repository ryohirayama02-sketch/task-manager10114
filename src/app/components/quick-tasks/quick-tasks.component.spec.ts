import { ComponentFixture, TestBed } from '@angular/core/testing';

import { QuickTasksComponent } from './quick-tasks.component';

describe('QuickTasksComponent', () => {
  let component: QuickTasksComponent;
  let fixture: ComponentFixture<QuickTasksComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [QuickTasksComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(QuickTasksComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
