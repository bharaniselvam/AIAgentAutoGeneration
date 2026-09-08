import { test, expect } from '../../../fixtures/auth.fixture';
import { EmployeeListPage } from '../../../pages/employee-list.page';
import { AddEmployeePage } from '../../../pages/add-employee.page';
import testData from '../../../test-data/add-employee.data.json';

test('TC-52407: Add a New Employee', async ({ page }) => {
  const { firstName, middleName, lastName } = testData['TC-52407'];

  await page.goto('/web/index.php/dashboard/index');

  const employeeListPage = new EmployeeListPage(page);
  await employeeListPage.openViaNav();
  await employeeListPage.clickAdd();

  const addEmployeePage = new AddEmployeePage(page);
  await addEmployeePage.fillName(firstName, middleName, lastName);

  const employeeId = await addEmployeePage.getGeneratedEmployeeId();
  expect(employeeId).toBeTruthy();

  await addEmployeePage.save();
  expect(page.url()).toContain('/pim/viewPersonalDetails/empNumber/');

  await employeeListPage.openViaNav();
  await employeeListPage.searchByEmployeeId(employeeId);
  await expect(employeeListPage.rowByEmployeeId(employeeId)).toContainText(
    `${firstName} ${middleName}`
  );
  await expect(employeeListPage.rowByEmployeeId(employeeId)).toContainText(lastName);
});
