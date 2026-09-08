import { test, expect } from '../../../fixtures/auth.fixture';
import { EmployeeListPage } from '../../../pages/employee-list.page';
import { PersonalDetailsPage } from '../../../pages/personal-details.page';
import testData from '../../../test-data/update-employee-details.data.json';

test('TC-52478: Update Employee Details', async ({ page }) => {
  const { employeeId, firstName, middleName, lastName, gender } = testData['TC-52478'];

  await page.goto('/web/index.php/dashboard/index');

  const employeeListPage = new EmployeeListPage(page);
  await employeeListPage.openViaNav();
  await employeeListPage.openEmployeeById(employeeId);

  const personalDetailsPage = new PersonalDetailsPage(page);
  await personalDetailsPage.updateName(firstName, middleName, lastName);
  await personalDetailsPage.selectGender(gender as 'Male' | 'Female');
  await personalDetailsPage.save();

  await page.reload();
  await expect(personalDetailsPage.firstNameInput).toHaveValue(firstName);
  await expect(personalDetailsPage.middleNameInput).toHaveValue(middleName);
  await expect(personalDetailsPage.lastNameInput).toHaveValue(lastName);
});
