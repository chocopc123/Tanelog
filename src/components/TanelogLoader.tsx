import React, { useState } from "react";
import { motion } from "motion/react";
import { Sprout, Droplets } from "lucide-react";

interface TanelogLoaderProps {
  message?: string;
}

export const TanelogLoader: React.FC<TanelogLoaderProps> = ({ 
  message = "たねログを準備しています..." 
}) => {
  const [logoError, setLogoError] = useState(false);

  return (
    <div className="fixed inset-0 bg-emerald-50/40 backdrop-blur-xs flex flex-col items-center justify-center p-6 z-50 overflow-hidden font-sans select-none">
      
      {/* 背景のやさしい緑のグラデーション光 */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-80 h-80 bg-emerald-100/30 rounded-full blur-3xl -z-10" />

      <div className="max-w-md w-full text-center space-y-10 flex flex-col items-center">
        
        {/* イラストのアニメーションコンテナ */}
        <div className="relative w-36 h-36 flex items-center justify-center">
          
          {/* 1. 水滴が落ちてくるアニメーション */}
          <motion.div
            initial={{ y: -30, opacity: 0, scale: 0.6 }}
            animate={{ 
              y: [20, 50], 
              opacity: [0, 1, 1, 0],
              scale: [0.6, 1.2, 1, 0.8]
            }}
            transition={{
              duration: 2.2,
              repeat: Infinity,
              ease: "easeInOut",
              times: [0, 0.3, 0.7, 1]
            }}
            className="absolute top-2 text-emerald-500 shrink-0"
          >
            <Droplets className="w-8 h-8 drop-shadow-sm" />
          </motion.div>

          {/* 2. 背景の円（やわらかな鼓動） */}
          <motion.div 
            animate={{ 
              scale: [1, 1.05, 0.98, 1],
              opacity: [0.3, 0.5, 0.3] 
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              ease: "easeInOut"
            }}
            className="absolute w-28 h-28 bg-emerald-200/40 rounded-full flex items-center justify-center -z-10"
          />

          {/* 3. たねログロゴ or 芽とキラキラ */}
          <div className="relative">
            {/* 芽ぐむSprout */}
            <motion.div
              animate={{ 
                scale: [1, 1.08, 0.98, 1],
                rotate: [0, -3, 3, 0],
                y: [0, -2, 0]
              }}
              transition={{
                duration: 2.2,
                repeat: Infinity,
                ease: "easeInOut"
              }}
              className="text-emerald-700 bg-white p-5 rounded-full shadow-lg border border-emerald-100/80 relative"
            >
              {/* たねログのロゴがあれば表示、無ければSproutを表示 */}
              <div className="w-12 h-12 flex items-center justify-center">
                {!logoError ? (
                  <img 
                    src="/tanelog.png" 
                    alt="たねログ" 
                    className="w-11 h-11 object-contain" 
                    onError={() => {
                      // ロゴ画像が無かった場合のフォールバック
                      setLogoError(true);
                    }}
                    referrerPolicy="no-referrer" 
                  />
                ) : (
                  <Sprout className="w-10 h-10 text-emerald-600" />
                )}
              </div>
            </motion.div>
          </div>
        </div>

        {/* 4. メインローディングメッセージ */}
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-50 border border-emerald-150/70 text-emerald-800 text-xs font-semibold rounded-full shadow-2xs">
            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping"></span>
            <span>栽培準備中</span>
          </div>
          <h3 className="text-lg font-bold text-slate-800 tracking-tight transition-all duration-300">
            {message}
          </h3>
        </div>
      </div>
    </div>
  );
};
