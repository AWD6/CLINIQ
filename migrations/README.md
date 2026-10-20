# Google Sheets schema migration

This project uses a repeatable Apps Script migration instead of SQL migrations.

- `apps-script/Migrations.gs` defines the sheet tabs and column headers.
- Run `setupSpreadsheet()` from the Apps Script editor to create the private spreadsheet and apply missing tabs. Existing rows are preserved.
- `apps-script/Seed.gs` defines `seedDemoData()`, which inserts the six demo clinics, physician placeholders, and sample weekly schedule templates without duplicating existing records.
- `setupSpreadsheet()` runs the seed function automatically. To seed again after editing sample data, run `seedDemoData()` manually.

The spreadsheet tabs act as tables. This schema migration does not provide Google Sheets native row-level security. The Apps Script web app enforces server-side access checks before reading or writing rows.
