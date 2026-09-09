import { Page } from '@playwright/test';
import { BasePage } from './base.page';

export class EmployeeListPage extends BasePage {
  private readonly pimNavLink = this.page.getByRole('link', { name: 'PIM' });
  private readonly addButton = this.page.getByRole('button', { name: 'Add' });
  // The Employee Id search field has no accessible name in the OrangeHRM markup,
  // so it's located via its label's containing group instead of getByRole/getByLabel.
  private readonly employeeIdSearchInput = this.page
    .locator('.oxd-input-group', { hasText: 'Employee Id' })
    .locator('input');
  // Employee Name and Supervisor Name share the identical accessible name
  // ("Type for hints...") in the OrangeHRM markup, so this is scoped by its label group too.
  private readonly employeeNameSearchInput = this.page
    .locator('.oxd-input-group', { hasText: 'Employee Name' })
    .locator('input');
  private readonly searchButton = this.page.getByRole('button', { name: 'Search' });

  constructor(page: Page) {
    super(page);
  }

  async openViaNav(): Promise<void> {
    await this.pimNavLink.click();
    await this.page.waitForURL('**/pim/viewEmployeeList');
  }

  async clickAdd(): Promise<void> {
    await this.addButton.click();
    await this.page.waitForURL('**/pim/addEmployee');
  }

  async searchByEmployeeId(employeeId: string): Promise<void> {
    await this.employeeIdSearchInput.fill(employeeId);
    await this.searchButton.click();
  }

  async searchByEmployeeName(name: string): Promise<void> {
    // pressSequentially (rather than fill) triggers the autocomplete debounce;
    // clicking Search directly works without selecting a suggestion from the dropdown.
    await this.employeeNameSearchInput.click();
    await this.employeeNameSearchInput.pressSequentially(name);
    await this.searchButton.click();
  }

  rowByEmployeeId(employeeId: string) {
    return this.page.getByRole('row', { name: new RegExp(`\\b${employeeId}\\b`) });
  }

  async openEmployeeById(employeeId: string): Promise<void> {
    await this.searchByEmployeeId(employeeId);
    await this.rowByEmployeeId(employeeId).click();
    await this.page.waitForURL('**/pim/viewPersonalDetails/empNumber/**');
  }
}
