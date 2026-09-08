import { Page } from '@playwright/test';
import { BasePage } from './base.page';

export class AddEmployeePage extends BasePage {
  private readonly firstNameInput = this.page.getByRole('textbox', { name: 'First Name' });
  private readonly middleNameInput = this.page.getByRole('textbox', { name: 'Middle Name' });
  private readonly lastNameInput = this.page.getByRole('textbox', { name: 'Last Name' });
  // No accessible name on this input in the OrangeHRM markup; scoped via its label group.
  private readonly employeeIdInput = this.page
    .locator('.oxd-input-group', { hasText: 'Employee Id' })
    .locator('input');
  private readonly saveButton = this.page.getByRole('button', { name: 'Save' });

  constructor(page: Page) {
    super(page);
  }

  async fillName(firstName: string, middleName: string, lastName: string): Promise<void> {
    await this.firstNameInput.fill(firstName);
    await this.middleNameInput.fill(middleName);
    await this.lastNameInput.fill(lastName);
  }

  async getGeneratedEmployeeId(): Promise<string> {
    return this.employeeIdInput.inputValue();
  }

  async save(): Promise<void> {
    // The shared public OrangeHRM demo auto-generates the next Employee Id on page
    // load, so concurrent testers can claim it first by save time. Retry with the
    // next id when that specific collision is reported.
    const maxAttempts = 3;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      await this.saveButton.click();
      try {
        await this.page.waitForURL('**/pim/viewPersonalDetails/empNumber/**', { timeout: 10_000 });
        return;
      } catch (error) {
        const duplicateIdError = this.page.getByText('Employee Id already exists');
        if (attempt < maxAttempts && (await duplicateIdError.isVisible())) {
          const currentId = await this.employeeIdInput.inputValue();
          const nextId = String(Number(currentId) + 1).padStart(currentId.length, '0');
          await this.employeeIdInput.fill(nextId);
          continue;
        }
        throw error;
      }
    }
  }
}
