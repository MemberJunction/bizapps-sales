# -*- coding: utf-8 -*-
"""
Comment-versus-reality drift audit.

For every query: collect the identifiers its comments and metadata NAME as columns it returns, and
check each one is actually in the SELECT list. A documented column that is not returned is a bug
report waiting to happen — a consumer writes against the description, gets undefined, and the fault
looks like the data rather than the doc.
"""
import io, json, os, re, glob, sys

# Repo-relative, NOT absolute. This hardcoded one developer's worktree, so on any other
# machine it audited a directory that does not exist -- and because the script also exited 0
# unconditionally, that read as a pass. Two defects that hid each other.
REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
JSONDIR = os.path.join(REPO, 'metadata', 'queries')
SQLDIR = os.path.join(JSONDIR, 'SQL')

def output_columns(sql_text):
    """The aliases the outermost SELECT actually produces."""
    cols = set()
    # `expr AS [Name]` / `expr AS Name` — the alias form these queries use throughout.
    for m in re.finditer(r'\bAS\s+\[?([A-Za-z_][A-Za-z0-9_]*)\]?', sql_text):
        cols.add(m.group(1))
    # Bare `alias.Column,` projections with no AS.
    for m in re.finditer(r'^\s+[A-Za-z_][A-Za-z0-9_]*\.\[?([A-Za-z_][A-Za-z0-9_]*)\]?\s*,', sql_text, re.M):
        cols.add(m.group(1))
    return cols

# Identifiers a comment might name that are NOT output columns: source tables, source columns,
# parameters, MJ internals. Naming one of those is not drift.
KNOWN_NON_OUTPUT = {
    # source columns / tables
    'Amount', 'AmountIsComputed', 'Probability', 'ExpectedCloseDate', 'ActualCloseDate', 'DealLine',
    'OrderLine', 'ProductID', 'DiscountPct', 'DiscountAmount', 'LineTotalNet', 'UnitPrice', 'OrderID',
    'RecordID', 'ChangesJSON', 'TrackRecordChanges', 'RecordChange', 'DealStageEvent', 'ChangedAt',
    'AmountAtTransition', 'ProbabilityAtTransition', 'DaysInPreviousStage', 'AttributionPct',
    'IsOwnerRole', 'DealRole', 'DealTeamMember', 'OwnerEmployeeID', 'DealStatusType', 'IsWon', 'IsOpen',
    'IsLost', 'IsClosed', 'IncludeInCommit', 'IncludeInBestCase', 'IncludeInPipeline', 'DealType',
    'RequiresRenewalSource', 'RenewsContractID', 'ForecastSnapshot', 'ForecastCategoryType',
    'CommitAmount', 'BestCaseAmount', 'PipelineAmount', 'ClosedAmount', 'SnapshotJSON', 'PeriodStart',
    'PeriodEnd', 'CapturedAt', 'CompanyID', 'PipelineID', 'PipelineStage', 'DisplayOrder', 'Deal',
    'Pipeline', 'Quota', 'Entity', 'Query', 'SYSUTCDATETIME', 'PERCENTILE_CONT', 'NULLIF', 'DATEFROMPARTS',
    'DATEPART', 'JSON_VALUE', 'TRY_CONVERT', 'CONVERT', 'SUBSTRING', 'CHARINDEX', 'UNIQUEIDENTIFIER',
    'DATE', 'Status', 'Name', 'ID', 'Granularity', 'OpenOnly', 'WonOnly', 'CapturedOnOrBefore',
    'OwnerEmployee', 'Commit', 'BestCase', 'Closed', 'Msg', 'Sales', 'Skip', 'Nunjucks', 'SQL',
    'DealID', 'FromDate', 'ToDate', 'StartedAt', 'FirstEventAt',
}

# Phrases that clearly assert "this query RETURNS a column called X".
CLAIM = re.compile(
    r'`([A-Za-z_][A-Za-z0-9_]*)`\s+(?:below\s+)?(?:exposes|surfaces|reports|is\s+the\s+column|returns)'
    r'|(?:column|columns)\s+`([A-Za-z_][A-Za-z0-9_]*)`'
    r'|\b([A-Z][A-Za-z0-9]*(?:Count|Amount|Pct|Rate|Days|Date))\s+(?:below|column)\b'
)

findings = []
for f in sorted(glob.glob(os.path.join(SQLDIR, '*.sql'))):
    name = os.path.basename(f)
    text = io.open(f, encoding='utf-8').read()
    cols = output_columns(text)
    comments = '\n'.join(l for l in text.split('\n') if l.strip().startswith('--') or l.strip().startswith('*') or l.strip().startswith('/*'))

    # Every CamelCase identifier a comment mentions that LOOKS like an output column name.
    for m in re.finditer(r'`([A-Za-z_][A-Za-z0-9_]*)`', comments):
        ident = m.group(1)
        if ident in cols or ident in KNOWN_NON_OUTPUT:
            continue
        # Only flag things shaped like a measure column.
        if re.search(r'(Count|Amount|Pct|Rate|Days|Coverage)$', ident):
            findings.append((name, ident, 'comment names it as a column; not in the SELECT list'))

    # And the metadata description, which is the doc a consumer actually reads.
    jf = os.path.join(JSONDIR, '.' + name.replace('.sql', '') + '.json')
    if os.path.exists(jf):
        rec = json.load(io.open(jf, encoding='utf-8'))[0]['fields']
        blob = (rec.get('Description') or '') + ' ' + (rec.get('TechnicalDescription') or '')
        for m in re.finditer(r'\b([A-Z][A-Za-z0-9]*(?:Count|Amount|Pct|Rate|Days|Coverage))\b', blob):
            ident = m.group(1)
            if ident in cols or ident in KNOWN_NON_OUTPUT:
                continue
            findings.append((name, ident, 'metadata description names it; not in the SELECT list'))

files = glob.glob(os.path.join(SQLDIR, '*.sql'))
if not files:
    # An empty scan is not a pass. The absolute path this used to carry made exactly this
    # state look like success on every machine but one.
    print('  ERROR: no .sql files found under %s' % SQLDIR)
    sys.exit(2)

if findings:
    print('  DRIFT FOUND:')
    seen = set()
    for f, ident, why in findings:
        k = (f, ident)
        if k in seen:
            continue
        seen.add(k)
        print('    %-40s %-28s %s' % (f, ident, why))
else:
    print('  no comment-versus-reality drift found')
print(chr(10) + '  %d file(s) scanned' % len(files))

# EXIT NON-ZERO ON A FINDING. Without this the script printed 'DRIFT FOUND' and returned 0,
# so no caller could ever have failed on it -- a report dressed as a gate.
sys.exit(1 if findings else 0)
