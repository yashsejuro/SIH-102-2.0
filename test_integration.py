"""
Test integration with actual 5 Excel workbooks
"""
import sys
sys.path.insert(0, r'c:\Users\athar\OneDrive\Documents\SIH\backend')

from app.ml.integration import integrate_files, inspect_file
from pathlib import Path

workbooks = [
    r"c:\Users\athar\Downloads\Works Sanctioned.xlsx",
    r"c:\Users\athar\Downloads\Works Completed.xlsx",
    r"c:\Users\athar\Downloads\Expenditure on Completed and On-going Works as on Date.xlsx",
    r"c:\Users\athar\Downloads\Allocated Limit for Honble MPs.xlsx",
    r"c:\Users\athar\Downloads\Amount consented for Calamity.xlsx"
]

print("="*80)
print("TESTING INTEGRATION WITH 5 ACTUAL EXCEL WORKBOOKS")
print("="*80)

# First inspect each file individually
print("\n1. INSPECTING INDIVIDUAL FILES")
print("-"*80)
for wb_path in workbooks:
    try:
        info = inspect_file(wb_path)
        print(f"\n{info['filename']}")
        print(f"  Detected Role: {info['detected_role']} ({info['confidence']:.1f}% confidence)")
        print(f"  Selected Sheet: {info['selected_sheet']}")
        print(f"  Total Sheets: {len(info['sheets'])}")
        for sheet in info['sheets']:
            print(f"    - {sheet['sheet']}: {sheet['rows']} rows, {sheet['role']} ({sheet['confidence']:.1f}%)")
    except Exception as e:
        print(f"\nERROR inspecting {Path(wb_path).name}: {e}")
        import traceback
        traceback.print_exc()

# Now integrate all files
print("\n\n2. INTEGRATING ALL 5 FILES")
print("-"*80)
try:
    unified, summary = integrate_files(workbooks)
    
    print(f"\nIntegration Summary:")
    print(f"  Rows processed: {summary['rows_processed']:,}")
    print(f"  Projects created: {summary['projects_created']:,}")
    print(f"  Matched completed: {summary['matched_completed']:,}")
    print(f"  Matched expenditure: {summary['matched_expenditure']:,}")
    print(f"  Allocation matched: {summary['allocation_matched']:,}")
    print(f"  Calamity count: {summary['calamity_count']:,}")
    print(f"  Conflicts detected: {len(summary['conflicts'])}")
    
    print(f"\nDataset details:")
    for ds in summary['datasets']:
        print(f"  - {ds['filename']}: {ds['detected_role']} ({ds['confidence']:.1f}%)")
    
    print(f"\nRelationship: {summary['relationship']}")
    
    if not unified.empty:
        print(f"\nUnified dataset columns: {list(unified.columns)}")
        print(f"\nSample unified data (first 3 rows):")
        print(unified[['project_id', 'project_name', 'state', 'category', 'sanction_amount', 'expenditure_amount', 'source_datasets']].head(3).to_string())
        
        print(f"\nSource dataset distribution:")
        source_counts = unified['source_datasets'].apply(lambda x: str(x)).value_counts()
        for sources, count in source_counts.items():
            print(f"  {sources}: {count} projects")
    else:
        print("\nWARNING: Unified dataset is empty!")
        
except Exception as e:
    print(f"\nERROR during integration: {e}")
    import traceback
    traceback.print_exc()

print("\n" + "="*80)
print("TEST COMPLETE")
print("="*80)
