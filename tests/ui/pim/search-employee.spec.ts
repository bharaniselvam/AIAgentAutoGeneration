import { test, expect } from '../../../fixtures/auth.fixture';
import { EmployeeListPage } from '../../../pages/employee-list.page';
import testData from '../../../test-data/search-employee.data.json';

test.describe('TC-52876 Search for an Employee', () => {
  test('TC-52876: Search for an employee by name returns the matching employee', async ({ page }) => {
    // "Jenifa Joylene" (Employee Id 0452) was chosen during live exploration of the
    // shared OrangeHRM QA demo instance as a plausible, name-unique employee record
    // ("(1) Record Found" at verification time), unlike other "nice-looking" names
    // ("Dharmik H Dave", "Hans Christian Lozano", "Harry Kane") that were observed to
    // be duplicated by other concurrent automation against this same public demo.
    // See specs/tc-52876-search-for-an-employee.md for the full rationale.
    const { employeeId, firstName, lastName } = testData['TC-52876'];

    // 1. Assumption: start from the authenticated landing page produced by tests/seed.spec.ts
    // (storageState already logged in as a valid OrangeHRM user on the `qa` project).
    // tests/seed.spec.ts does not run automatically before this spec file, so navigate
    // explicitly rather than assuming the page is already on the dashboard.
    await page.goto('/web/index.php/dashboard/index');
    await expect(page.getByRole('link', { name: 'PIM' })).toBeVisible();

    // 2. Click the 'PIM' link in the left sidebar navigation.
    const employeeListPage = new EmployeeListPage(page);
    await employeeListPage.openViaNav();

    await expect(page).toHaveURL(/\/pim\/viewEmployeeList/);
    await expect(page.getByRole('heading', { name: 'Employee Information' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Employee List' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Add Employee' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Reports' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Reset' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Search' })).toBeVisible();
    await expect(page.getByText(/\(\d+\) Records? Found/)).toBeVisible();

    // 3-4. Type the employee's full name into the Employee Name type-ahead field and
    // click Search. Per verified live behavior, typing the name alone is sufficient -
    // selecting a suggestion from the dropdown is not required and is intentionally skipped.
    await employeeListPage.searchByEmployeeName(`${firstName} ${lastName}`);

    await expect(page.getByText('(1) Record Found')).toBeVisible();
    const matchingRow = employeeListPage.rowByEmployeeId(employeeId);
    await expect(matchingRow).toContainText(firstName);
    await expect(matchingRow).toContainText(lastName);

    // 5. Assert on the specific expected row: locate the table row containing 'Jenifa' and
    // 'Joylene' and verify it is visible, and verify its Id cell equals '0452'.
    await expect(matchingRow).toBeVisible();
    await expect(matchingRow.getByRole('cell', { name: employeeId })).toBeVisible();
  });
});
