import type {ReactNode} from 'react';

export type CatalogFactSectionKey =
  | 'basic'
  | 'identifiers'
  | 'sku-specifications-pricing'
  | 'attributes'
  | 'order-options'
  | 'production-prompts'
  | 'inventory-bom'
  | 'composite-content'
  | 'governance';

type Props = {
  section: CatalogFactSectionKey;
  children: ReactNode;
};

function FactSectionFrame({section, children, surface}: Props & {surface: 'view' | 'editor'}) {
  return (
    <section data-catalog-fact-section={section} data-catalog-fact-surface={surface}>
      {children}
    </section>
  );
}

export function CatalogFactSectionView(props: Props) {
  return <FactSectionFrame {...props} surface="view" />;
}

export function CatalogFactSectionEditor(props: Props) {
  return <FactSectionFrame {...props} surface="editor" />;
}
