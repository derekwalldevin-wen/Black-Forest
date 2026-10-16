"""Subset the pinned OFL font without changing its outlines. Run after text additions."""
from pathlib import Path
from fontTools import subset
from fontTools.ttLib import TTFont
import hashlib, json, unicodedata

root = Path(__file__).resolve().parent.parent
source = root / '.tmp-gen/font-source/NotoSerifCJKsc-Regular.otf'
target = root / 'assets/fonts/BlackForestSerif-Regular.woff'
files = sorted((root / 'src').rglob('*.js')) + sorted((root / 'locales').glob('*.js')) + [root / 'index.html']
text = ''.join(p.read_text(encoding='utf-8') for p in files)
chars = set(map(ord, text)) | set(range(0x20, 0x180))
font = TTFont(source)
cmap = font.getBestCmap()
copyright_text = font['name'].getDebugName(0)
options = subset.Options()
options.name_IDs = ['*']
options.name_legacy = True
options.name_languages = ['*']
subsetter = subset.Subsetter(options=options)
subsetter.populate(unicodes=chars & set(cmap))
# fontTools 4.41 NameRecordVisitor recursively traverses this CJK font's
# shared layout graph. We keep ALL name records, so that traversal is unnecessary.
names = font['name']
del font['name']
subsetter.subset(font)
font['name'] = names
# Use a distinct family name for this modified/subset distribution.
for record in font['name'].names:
    names = {1:'Black Forest Serif', 2:'Regular', 3:'BlackForestSerif-Subset-1', 4:'Black Forest Serif Regular', 6:'BlackForestSerif-Regular', 16:'Black Forest Serif', 17:'Regular'}
    if record.nameID in names:
        record.string = names[record.nameID].encode(record.getEncoding())
if 'CFF ' in font:
    cff = font['CFF '].cff
    cff.fontNames = ['BlackForestSerif-Regular']
    cff.topDictIndex[0].FamilyName = 'Black Forest Serif'
    cff.topDictIndex[0].FullName = 'Black Forest Serif Regular'
font.flavor = 'woff'
font.save(target)
out = TTFont(target)
source_chars = set(map(ord, text))
missing = sorted(c for c in source_chars if c >= 32 and unicodedata.category(chr(c)) not in ['Cc','Cf'] and c not in out.getBestCmap())
manifest = {
    'upstream':'https://github.com/notofonts/noto-cjk',
    'commit':'f8d157532fbfaeda587e826d4cd5b21a49186f7c',
    'source':'Serif/OTF/SimplifiedChinese/NotoSerifCJKsc-Regular.otf',
    'sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest(),
    'file':str(target.relative_to(root)).replace('\\','/'),
    'sha256':hashlib.sha256(target.read_bytes()).hexdigest(),
    'bytes':target.stat().st_size,'glyphs':len(out.getBestCmap()),
    'license':'SIL Open Font License 1.1','copyright':copyright_text,
    'modifications':'Subset of source/locales text plus Latin U+0020–017F; renamed family; WOFF compression. Outlines unchanged. Bold is synthesized by the browser.',
    'unsupportedSourceCharacters':[{'character':chr(c),'codepoint':f'U+{c:04X}'} for c in missing]
}
(root/'assets/fonts/MANIFEST.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
(root/'assets/fonts/NOTICE.txt').write_text(copyright_text+'\n\nDerived from Noto Serif CJK SC, under SIL OFL 1.1.\nSubset and renamed Black Forest Serif; outlines unchanged.\nSee OFL.txt and MANIFEST.json.\n',encoding='utf-8')
print(json.dumps({'bytes':manifest['bytes'],'glyphs':manifest['glyphs'],'unsupportedSourceCharacters':manifest['unsupportedSourceCharacters']},ensure_ascii=True))
