import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MembersOverviewComponent } from './members-overview.component';

describe('MembersOverviewComponent', () => {
  let component: MembersOverviewComponent;
  let fixture: ComponentFixture<MembersOverviewComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MembersOverviewComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MembersOverviewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
