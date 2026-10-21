# Google Sheets migration

This project uses a repeatable Apps Script migration instead of SQL migrations.

- `apps-script/Migrations.gs` defines the sheet tabs and column headers.
- Run `setupSpreadsheet()` from the Apps Script editor to create the private spreadsheet and apply missing tabs. Existing rows are preserved.
- `apps-script/Seed.gs` defines `seedDemoData()`, which inserts the six demo clinics, physician placeholders, and sample weekly schedule templates without duplicating existing records.
- `setupSpreadsheet()` runs the seed function automatically. To seed again after editing sample data, run `seedDemoData()` manually.

The spreadsheet tabs act as tables. Google Sheets does not provide row-level security here. The app filters each view based on the page selected, but selecting Admin is not an identity check: anyone with the public app URL can select Admin and edit the sheet through the app. Use only non-sensitive schedule data until a simple admin PIN is added.
