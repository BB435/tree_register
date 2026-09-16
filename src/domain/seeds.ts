import type { Category, Tag, Snapshot, SourceNode } from "../shared/types";
const groups: Record<string, string[]> = {
  "企画・要求": ["新規", "継続", "優先", "要確認", "課題", "計画"],
  "設計・標準": ["設計", "標準", "構成", "仕様", "方針", "レビュー"],
  "開発・構築": ["開発", "構築", "変更", "自動化", "移行", "リリース"],
  "試験・品質": ["試験", "検証", "品質", "承認", "課題あり", "完了"],
  "運用・監視": ["運用", "監視", "定期作業", "記録", "問い合わせ", "改善"],
  "保守・変更": ["保守", "障害", "復旧", "原因調査", "影響あり", "対応中"],
  "セキュリティ・統制": ["セキュリティ", "権限", "脆弱性", "監査", "リスク", "インシデント"],
  "ネットワーク・接続": ["ネットワーク", "接続", "外部連携", "拠点", "通信", "停止"],
  "サーバー・基盤": ["基盤", "サーバー", "クラウド", "データベース", "ストレージ", "端末"],
  "データ・バックアップ": ["データ", "バックアップ", "復元", "保存", "連携", "削除"],
  "文書・契約": ["台帳", "文書", "契約", "資産", "ライセンス", "引継ぎ"]
};
export function seedTags() {
  const categories: Category[] = Object.keys(groups).map((name,i)=>({id:'category-'+i,name}));
  const tags: Tag[] = categories.flatMap(c=>groups[c.name].map((label,i)=>({id:c.id+'-tag-'+i,label,categoryId:c.id})));
  return {categories,tags};
}
export function sampleState(): Snapshot {
 const {categories,tags}=seedTags();const nodes:SourceNode[]=[];
 const add=(name:string,kind:'folder'|'file',parentId:string|null,title=name,labels:string[]=[],mode?:SourceNode['mode'])=>{
 const parent=nodes.find(n=>n.id===parentId);const sourcePath=parent?parent.sourcePath+'/'+name:name;
 const node:SourceNode={id:'sample-'+nodes.length,name,kind,parentId,title,description:'地域の公開データを整理したサンプルです。',tagIds:tags.filter(t=>labels.includes(t.label)).map(t=>t.id),catalogCategoryId: kind === 'folder' ? categories[0]?.id : undefined,sourcePath,absolutePath:'demo:/'+sourcePath,depth:parent?parent.depth+1:1,mode:mode??(kind==='file'?'dataset':parentId?'sub':'top'),inherit:false};nodes.push(node);return node.id;
 };
 const root=add('内部インフラ台帳','folder',null,'内部インフラ台帳',['台帳','構成']);
 const population=add('01_企画・開発','folder',root,'企画・開発基盤',['新規','開発']);
 add('要件一覧.csv','file',population,'インフラ要件一覧',['仕様']);
 const household=add('世帯数.csv','file',population);nodes.find(n=>n.id===household)!.inherit=true;
 const environment=add('02_運用・保守','folder',root,'運用・保守基盤',['運用','保守']);
 add('監視記録.csv','file',environment,'インフラ監視記録',['監視']);
 add('復旧手順.xlsx','file',root,'障害復旧手順',['復旧'],'standalone');
 add('README.txt','file',root,'README',[],'exclude');
 add('作業用','folder',root,'作業用',[],'exclude');
 return {nodes,tags,categories,registry:[{sourceId:'demo',path:'内部インフラ台帳/01_企画・開発',catalogId:'CAT-2026-0042',title:'企画・開発基盤',registeredAt:'2026-09-01'}],settings:{maxDepth:3,sourceId:'demo',sourceRoots:{demo:'demo:/'},excludedExtensions:[],depthPolicy:'error'},rootPath:'demo:/内部インフラ台帳',demo:true,failure:null};
}
