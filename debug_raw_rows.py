from pathlib import Path
from app.config import settings
from app.ml.workbook_reader import read_workbook

paths = [Path(settings.demo_data_dir) / name for name in settings.default_demo_files]
for path in paths:
    print('\n===', path.name, '===')
    sheets = read_workbook(path)
    for sheet_name, raw in sheets.items():
        print('sheet', sheet_name, 'shape', raw.shape)
        print(raw.head(3).to_string())
        print('columns', raw.columns.tolist())
        break
