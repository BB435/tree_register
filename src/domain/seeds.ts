import type { Category, Tag, Snapshot, SourceNode } from "../shared/types";
const groups: Record<string, string[]> = {
  "企画・要求": ["新規企画", "要求整理", "利用者課題", "業務要件", "非機能要件", "優先度", "ロードマップ", "予算", "体制", "稟議", "合意形成", "廃止検討"],
  "設計・標準": ["基本設計", "詳細設計", "構成設計", "運用設計", "標準化", "命名規則", "アーキテクチャ", "容量計画", "可用性", "性能設計", "拡張性", "設計レビュー"],
  "開発・構築": ["開発", "構築", "設定変更", "自動化", "Infrastructure as Code", "スクリプト", "リリース", "移行", "環境差分", "開発環境", "検証環境", "本番環境"],
  "試験・品質": ["単体試験", "結合試験", "受入試験", "性能試験", "障害試験", "復旧試験", "品質確認", "レビュー済み", "未解決課題", "再現手順", "試験証跡", "リリース判定"],
  "運用・監視": ["定常運用", "監視", "アラート", "稼働状況", "キャパシティ", "ジョブ", "ログ", "バックアップ", "定期点検", "問い合わせ", "手順書", "運用改善"],
  "保守・変更": ["保守", "障害対応", "原因分析", "復旧", "パッチ適用", "バージョンアップ", "変更管理", "構成管理", "影響調査", "再発防止", "老朽化", "保守期限"],
  "セキュリティ・統制": ["アクセス制御", "認証", "権限", "脆弱性", "セキュリティパッチ", "監査", "証跡", "個人情報", "機密情報", "リスク", "インシデント", "規程"],
  "ネットワーク・接続": ["LAN", "WAN", "インターネット", "VPN", "ファイアウォール", "DNS", "負荷分散", "プロキシ", "無線LAN", "拠点接続", "外部連携", "ネットワーク障害"],
  "サーバー・基盤": ["サーバー", "仮想化", "クラウド", "データセンター", "ストレージ", "データベース", "OS", "コンテナ", "ミドルウェア", "端末", "電源・空調", "基盤更改"],
  "データ・バックアップ": ["データ管理", "バックアップ設計", "世代管理", "リストア", "災害対策", "遠隔地保管", "データ連携", "データ品質", "保存期間", "アーカイブ", "削除", "復旧目標"],
  "文書・契約": ["台帳", "構成図", "資産管理", "契約", "ライセンス", "調達", "ベンダー管理", "見積", "議事録", "連絡先", "引継ぎ", "ナレッジ"]
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
 const root=add('内部インフラ台帳','folder',null,'内部インフラ台帳',['台帳','構成管理']);
 const population=add('01_企画・開発','folder',root,'企画・開発基盤',['新規企画','開発環境']);
 add('要件一覧.csv','file',population,'インフラ要件一覧',['要求整理']);
 const household=add('世帯数.csv','file',population);nodes.find(n=>n.id===household)!.inherit=true;
 const environment=add('02_運用・保守','folder',root,'運用・保守基盤',['定常運用','保守']);
 add('監視記録.csv','file',environment,'インフラ監視記録',['監視']);
 add('復旧手順.xlsx','file',root,'障害復旧手順',['復旧'],'standalone');
 add('README.txt','file',root,'README',[],'exclude');
 add('作業用','folder',root,'作業用',[],'exclude');
 return {nodes,tags,categories,registry:[{sourceId:'demo',path:'内部インフラ台帳/01_企画・開発',catalogId:'CAT-2026-0042',title:'企画・開発基盤',registeredAt:'2026-09-01'}],settings:{maxDepth:3,sourceId:'demo',sourceRoots:{demo:'demo:/'},excludedExtensions:[],depthPolicy:'error'},rootPath:'demo:/内部インフラ台帳',demo:true,failure:null};
}
