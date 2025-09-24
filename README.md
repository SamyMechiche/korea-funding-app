# Korea Trip Budget App

A simple, pretty, offline-friendly budgeting app to track your Korea trip.

- Add income (withdrawals/top-ups) and expenses (payments) in KRW
- See automatic conversion to EUR using a live rate (with manual override and fallback)
- Set a trip budget and track remaining balance
- Transactions list with edit/delete and CSV export
- Data saved locally via localStorage

## Usage

1. Open `index.html` in your browser (double-click).
2. Click Refresh to pull the latest KRW→EUR rate. If offline, enter a manual rate.
3. Set your total budget in KRW.
4. Add transactions. The app shows totals and remaining budget in KRW and EUR.
5. Use Export CSV to back up your data.

No server or build steps required.

## Notes

- Live rates are fetched from `exchangerate.host`. If it fails, the app uses the last saved or a fallback rate (~1 EUR ≈ 1500 KRW).
- All data stays in your browser. Clearing site data or using a different browser/computer will reset it.
