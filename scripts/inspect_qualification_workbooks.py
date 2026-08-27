from pathlib import Path

from openpyxl import load_workbook


desktop = Path.home() / "Desktop"
candidates = list(desktop.glob("*.xlsx"))
target_files = [path for path in candidates if "20260814" in path.name]
target_files.extend(
    path for path in candidates
    if 100_000 < path.stat().st_size < 300_000 and path not in target_files
)
qualification_codes = {
    "RAMA", "REUO", "RWAS", "RSEA", "EAMA", "EEUO", "EWAS", "ESEA",
    "RANC", "RORD", "RJFK", "RLAX", "RNLU",
}


def display(value: object) -> str:
    text = "" if value is None else str(value).replace("\r", " ").replace("\n", " ")
    return text[:80]


for workbook_path in target_files:
    print(f"WORKBOOK\t{workbook_path.name}\t{workbook_path.stat().st_size}")
    workbook = load_workbook(workbook_path, read_only=False, data_only=True)
    for worksheet in workbook.worksheets:
        print(
            f"SHEET\t{worksheet.title}\trows={worksheet.max_row}\tcols={worksheet.max_column}"
            f"\tmerged={len(worksheet.merged_cells.ranges)}\tstate={worksheet.sheet_state}"
        )
        hit_rows: list[int] = []
        for row in worksheet.iter_rows(min_row=1, max_row=min(worksheet.max_row, 120)):
            values = {display(cell.value).strip().upper() for cell in row}
            if len(values & qualification_codes) >= 2:
                hit_rows.append(row[0].row)
        rows_to_show = set(range(1, min(worksheet.max_row, 15) + 1))
        for row_number in hit_rows:
            rows_to_show.update(range(max(1, row_number - 3), min(worksheet.max_row, row_number + 5) + 1))
        for row_number in sorted(rows_to_show):
            cells = []
            for cell in worksheet[row_number]:
                value = display(cell.value)
                if value:
                    cells.append(f"{cell.coordinate}={value}")
            if cells:
                print(f"ROW\t{row_number}\t" + " | ".join(cells[:60]))
        print("TABLES\t" + ",".join(worksheet.tables.keys()))
    print("END")
