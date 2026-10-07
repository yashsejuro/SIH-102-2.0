from pathlib import Path
from app.config import settings
from app.ml.integration import canonicalize_file

paths = [Path(settings.demo_data_dir) / name for name in settings.default_demo_files]
for path in paths:
    frame, meta = canonicalize_file(path)
    print('FILE', path.name)
    print('detected_role', meta['detected_role'])
    print('columns', list(frame.columns))
    print('project_id_nonempty', int(frame['project_id'].fillna('').astype(str).str.strip().ne('').sum()))
    print('sample project_id', frame['project_id'].head(10).tolist())
    print('sample project_name', frame['project_name'].head(10).tolist())
    print('sample sanction_amount', frame['sanction_amount'].head(10).tolist())
    print('sample expenditure_amount', frame['expenditure_amount'].head(10).tolist())
    print('---')
