# TC-52876: Search for an Employee

## Application Overview

This plan covers ADO test case TC-52876 "Search for an employee" (Benefit Plans project, Benefit Reg Test plan). It targets the OrangeHRM QA demo instance's PIM > Employee List screen, using the `qa` Playwright project's pre-authenticated storageState session (see tests/seed.spec.ts, which lands on `/` already logged in — no login UI automation is needed to satisfy ADO step 1).

Environment note (important, discovered during live exploration): the OrangeHRM demo instance (`opensource-demo.orangehrmlive.com`) is a shared public demo used concurrently by many other automated test suites and QA tutorials worldwide. During a single exploration session the Employee List record count grew from 170 to 177 records within a few minutes, and several human-sounding names that initially looked like good, stable candidates ("Dharmik H Dave", "Hans Christian Lozano") were observed to become duplicated (two employees with the identical full name) while this plan was being written. "Harry Kane" and "John Smith" were already duplicated (6x and 2x respectively) at the start of exploration — these look like popular names reused by many other automation scripts/tutorials against this same public demo and were explicitly avoided as test data.

Employee chosen for this test: **Jenifa Joylene** (Employee Id `0452`). Rationale: it is a plausible human name (not an obviously random/hash-like string like "BRBgMxK gcoAZgJ" or "AddFirstmttu4thlym07" seen elsewhere in the list, which are clearly other automated tests' throwaway data), and at the time of verification it matched exactly one record ("(1) Record Found") when searched, unlike the other "nice-looking" names that turned out to be duplicated. Because this is a volatile shared environment, there is no guarantee this name stays unique indefinitely, so the test assertion is designed to check that the employee appears in the results (at least one matching row with that name) rather than asserting an exact record count of exactly one — this keeps the test robust if the record is duplicated later by other concurrent automation. The generator should treat "Jenifa Joylene" as configurable test data (e.g. sourced from /test-data or /config, not a magic string with no explanation) per project convention, and this rationale should be carried into a code comment.

Employee Name field behavior (documented from live observation, not assumed): the "Employee Name" field on the Employee List filter is a type-ahead combobox (`getByRole('textbox', { name: 'Type for hints...' })`). Real, observed behavior:
1. Typing a name (even partial, e.g. "Jenifa") shows a dropdown listbox of matching suggestions (`getByRole('option', ...)`) after a short debounce, but clicking "Search" works correctly WITHOUT ever selecting a suggestion from the dropdown — the typed free text alone is used as a name-contains filter and returns the correct, expected employee(s). This was verified directly: typing "Dharmik" and clicking Search (with the dropdown still open, unselected) returned "(1) Record Found" for the expected employee.
2. If a suggestion IS explicitly clicked/selected from the dropdown, the textbox is populated with the suggestion's full display name and the dropdown closes. Search then returns results scoped to that specific underlying employee record (verified: selecting "Dharmik H Dave" from the dropdown, when two employees shared that name, returned only the specific record tied to the selected suggestion — a different Employee Id than typing free text and searching did). This means dropdown selection binds the search to one specific employee record via a hidden id, whereas free-text search matches by name string across all employees.
3. Conclusion for automation: for this test case (searching by name and verifying the employee appears in results) it is sufficient, and simpler/more robust, to type the employee's name into the field and click Search directly, without needing to select a suggestion from the autocomplete dropdown. The generated script should NOT hard-require a dropdown selection step, though it may optionally wait for/dismiss the suggestion list if it interferes with the Search button (it did not in testing).

The Employee List "Search" button and "Reset" button are plain buttons (`getByRole('button', { name: 'Search' })` / `{ name: 'Reset' }`). Results are shown in a table below the filter panel with a "(N) Record(s) Found" / "(N) Records Found" summary text (`getByText(/Record(s)? Found/)`), and a "No Records Found" state exists for non-matching searches (not directly captured with a screenshot in this session but consistent with standard OrangeHRM behavior and the presence of a live, filterable list backed by a real record count control).

Navigation: PIM module is reached via the left sidebar "PIM" link, landing on the Employee List (URL path `/web/index.php/pim/viewEmployeeList`), matching ADO step 2 "Navigate to PIM → Employee List".

## Test Scenarios

### 1. TC-52876 Search for an Employee

**Seed:** `tests/seed.spec.ts`

#### 1.1. TC-52876: Search for an employee by name returns the matching employee

**File:** `tests/ui/pim/search-employee.spec.ts`

**Steps:**
  1. Assumption: start from the authenticated landing page produced by tests/seed.spec.ts (storageState already logged in as a valid OrangeHRM user on the `qa` project; base URL points at the OrangeHRM QA demo instance). This satisfies ADO step 1 (Login to OrangeHRM) — do not automate the login form.
    - expect: The dashboard page loads successfully with the main sidebar navigation visible (Admin, PIM, Leave, Time, Recruitment, My Info, Performance, Dashboard, Directory, Maintenance, Claim, Buzz).
  2. Click the 'PIM' link in the left sidebar navigation.
    - expect: The browser navigates to the PIM Employee List screen (URL contains /pim/viewEmployeeList).
    - expect: The page heading area shows 'PIM' and the topbar sub-menu shows 'Employee List', 'Add Employee', and 'Reports' links.
    - expect: An 'Employee Information' filter panel is visible containing fields: Employee Name, Employee Id, Employment Status, Include, Supervisor Name, Job Title, Sub Unit, plus 'Reset' and 'Search' buttons.
    - expect: Below the filter panel, an employee data table is visible with a '(N) Records Found' summary and columns Id, First (& Middle) Name, Last Name, Job Title, Employment Status, Sub Unit, Supervisor, Actions.
  3. Click the 'Employee Name' field (a type-ahead combobox, getByRole('textbox', { name: 'Type for hints...' }) within the Employee Name field group) and type the test employee's name, 'Jenifa Joylene' (Employee Id 0452 — chosen during exploration as a stable-looking, name-unique record; see plan overview for rationale). Type it slowly enough to trigger the autocomplete debounce (e.g. via pressSequentially or an explicit small wait) so the suggestion dropdown has a chance to appear.
    - expect: As text is typed, a suggestion dropdown (listbox with getByRole('option')) appears showing one or more matching employee names, including 'Jenifa Joylene'.
    - expect: Do NOT require selecting an option from this dropdown to proceed — per verified behavior, typing the name alone is sufficient for the subsequent Search to work correctly. If the generator chooses to select the suggestion instead, note that doing so scopes the search to that specific employee record via a hidden id and is an equally valid but distinct interaction — either approach should be documented with a comment explaining why it was chosen.
  4. Click the 'Search' button (getByRole('button', { name: 'Search' })).
    - expect: The employee table refreshes.
    - expect: The results summary text updates to '(1) Record Found' (or, if this shared demo environment has accumulated a duplicate by the time the test runs, '(N) Records Found' where N >= 1 and every returned row's First/Last name matches 'Jenifa'/'Joylene').
    - expect: At least one row in the results table shows First (& Middle) Name 'Jenifa' and Last Name 'Joylene', confirming the employee appears in the search results as required by the ADO expected result ('The system displays the matching employee in the Employee List').
  5. Assert on the specific expected row: locate the table row containing text 'Jenifa' and 'Joylene' and verify it is visible, and optionally verify its Id cell equals '0452' for stronger traceability (acceptable to relax this last check to 'contains the name' only, if long-term environment volatility make an exact Id match too brittle for CI).
    - expect: The row for employee Id 0452 / 'Jenifa Joylene' is present and visible in the Employee List results table.
    - expect: No unrelated employees are shown that would indicate the filter was not applied (i.e., the results are not simply the full unfiltered '(17x) Records Found' list).

#### 1.2. TC-52876a: Searching for a name with no matching employee shows no results (negative/edge case)

**File:** `tests/ui/pim/search-employee.spec.ts`

**Steps:**
  1. From the authenticated seed session, navigate to PIM > Employee List as in the primary test.
    - expect: The Employee List screen loads with its default unfiltered record count (e.g. '(N) Records Found').
  2. Type a name that is extremely unlikely to exist, e.g. 'Zzznonexistentname12345', into the Employee Name field, then click Search.
    - expect: The results panel shows a 'No Records Found' state (or equivalent zero-count summary) and the results table is empty of data rows.
    - expect: This confirms the search filter correctly narrows results and does not silently fall back to showing all employees when there is no match — an important negative-path guardrail for the generated script, complementing the ADO test case's happy-path-only documented steps.

#### 1.3. TC-52876b: Clearing the filter with Reset restores the full employee list (supporting/edge case)

**File:** `tests/ui/pim/search-employee.spec.ts`

**Steps:**
  1. From the authenticated seed session, navigate to PIM > Employee List, perform a name search for 'Jenifa' as in the primary test so results are filtered to (1) Record Found, then click the 'Reset' button.
    - expect: The Employee Name field is cleared back to empty / placeholder 'Type for hints...'.
    - expect: The results table reloads to show the full, unfiltered employee list again (records-found count returns to the larger total, e.g. '(17x) Records Found', not the filtered '(1)').
    - expect: This confirms Reset fully clears prior search state rather than leaving a stale filtered view, which is useful context for the generator when deciding whether tests need explicit cleanup/reset between assertions.
