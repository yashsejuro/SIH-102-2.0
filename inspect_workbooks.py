"""
Inspect all 5 Excel workbooks to understand structure
"""
import pandas as pd
from pathlib import Path
import json
import warnings
warnings.filterwarnings('ignore')

workbooks = [
    r"c:\Users\athar\Downloads\Works Sanctioned.xlsx",
    r"c:\Users\athar\Downloads\Works Completed.xlsx",
    r"c:\Users\athar\Downloads\Expenditure on Completed and On-going Works as on Date.xlsx",
    r"c:\Users\athar\Downloads\Allocated Limit for Honble MPs.xlsx",
    r"c:\Users\athar\Downloads\Amount consented for Calamity.xlsx"
]

results = {}

for wb_path in workbooks:
    wb_name = Path(wb_path).name
    print(f"\n{'='*80}")
    print(f"WORKBOOK: {wb_name}")
    print(f"{'='*80}")
    
    try:
        # Try calamine engine first (more robust)
        try:
            xl_file = pd.ExcelFile(wb_path, engine='calamine')
            sheet_names = xl_file.sheet_names
            print(f"Sheet names (calamine): {sheet_names}")
        except ImportError:
            print("calamine not available, trying openpyxl")
            xl_file = pd.ExcelFile(wb_path, engine='openpyxl')
            sheet_names = xl_file.sheet_names
            print(f"Sheet names (openpyxl): {sheet_names}")
        
        sheet_info = {}
        
        for sheet_name in sheet_names:
            print(f"\n--- Sheet: {sheet_name} ---")
            
            # Read first few rows to understand structure
            df = pd.read_excel(xl_file, sheet_name=sheet_name, nrows=10)
            print(f"Columns ({len(df.columns)}): {list(df.columns)}")
            print(f"\nFirst 3 rows:")
            print(df.head(3).to_string())
            
            # Get data types
            print(f"\nData types:")
            print(df.dtypes.to_string())
            
            # Try to read full sheet
            try:
                full_df = pd.read_excel(xl_file, sheet_name=sheet_name)
                print(f"\nTotal rows in sheet: {len(full_df)}")
                
                sheet_info[sheet_name] = {
                    "rows": len(full_df),
                    "columns": len(df.columns),
                    "column_names": list(df.columns),
                    "dtypes": {col: str(dtype) for col, dtype in df.dtypes.items()},
                    "sample_data": df.head(3).to_dict(orient='records')
                }
            except Exception as e:
                print(f"Error reading full sheet: {e}")
                sheet_info[sheet_name] = {
                    "error": str(e),
                    "columns": len(df.columns),
                    "column_names": list(df.columns)
                }
        
        xl_file.close()
        results[wb_name] = {
            "sheets": sheet_names,
            "sheet_info": sheet_info
        }
        
    except Exception as e:
        print(f"ERROR processing {wb_name}: {e}")
        import traceback
        traceback.print_exc()
        results[wb_name] = {"error": str(e)}

# Save results to JSON
output_path = r"c:\Users\athar\OneDrive\Documents\SIH\workbook_inspection.json"
with open(output_path, 'w', encoding='utf-8') as f:
    json.dump(results, f, indent=2, ensure_ascii=False)

print(f"\n{'='*80}")
print(f"Inspection complete. Results saved to: {output_path}")
print(f"{'='*80}")
