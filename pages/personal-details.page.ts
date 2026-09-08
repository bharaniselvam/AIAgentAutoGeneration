import { Page } from '@playwright/test';
import { BasePage } from './base.page';

export type Gender = 'Male' | 'Female';

export class PersonalDetailsPage extends BasePage {
  readonly firstNameInput = this.page.getByRole('textbox', { name: 'First Name' });
  readonly middleNameInput = this.page.getByRole('textbox', { name: 'Middle Name' });
  readonly lastNameInput = this.page.getByRole('textbox', { name: 'Last Name' });
  // Scoped to the Personal Details form specifically: the page has a second,
  // unrelated Save button for the Custom Fields section below it.
  private readonly saveButton = this.page
    .locator('form')
    .filter({ hasText: 'Employee Full Name' })
    .getByRole('button', { name: 'Save' });

  constructor(page: Page) {
    super(page);
  }

  async updateName(firstName: string, middleName: string, lastName: string): Promise<void> {
    await this.firstNameInput.fill(firstName);
    await this.middleNameInput.fill(middleName);
    await this.lastNameInput.fill(lastName);
  }

  async selectGender(gender: Gender): Promise<void> {
    // The underlying radio input is visually overlaid by a styled span that
    // intercepts pointer events, so the label text is clicked instead.
    await this.page.getByText(gender, { exact: true }).click();
  }

  async save(): Promise<void> {
    await Promise.all([
      this.page.waitForResponse(
        (response) =>
          response.url().includes('/api/v2/pim/employees/') &&
          response.url().includes('/personal-details') &&
          response.request().method() === 'PUT' &&
          response.ok()
      ),
      this.saveButton.click(),
    ]);
  }
}
