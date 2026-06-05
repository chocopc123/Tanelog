import { useEffect, DependencyList } from "react";

/**
 * 渡された依存値（ページ遷移をトリガーする状態）のいずれかが変化した時に、
 * ブラウザおよび主要なスクロールコンテナのスクロール位置を最上部にリセットするカスタムフック。
 */
export function useScrollToTop(deps: DependencyList) {
  useEffect(() => {
    // 1. windowオブジェクトのスクロール情報をリセット
    window.scrollTo({ top: 0, behavior: "instant" });

    // 2. html/body要素のスクロール情報をリセット (ブラウザやCSS構成ごとの互換対応)
    if (document.documentElement) {
      document.documentElement.scrollTop = 0;
    }
    if (document.body) {
      document.body.scrollTop = 0;
    }

    // 3. アプリケーション内の主要なメインコンテナ (要素セレクタ) や overflow-y が指定されていそうなコンテナも念のためカバー
    const containers = [
      document.querySelector("main"),
      document.getElementById("main-container"),
      document.getElementById("app-scroll-container"),
    ];

    containers.forEach((container) => {
      if (container) {
        container.scrollTop = 0;
      }
    });
  }, deps);
}
