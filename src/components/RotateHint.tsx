import { useEffect, useState } from 'react'
import face from '../assets/game/maroinu-face.jpg'

/** タッチ操作のタブレットで、縦向きのときだけ出す */
const QUERY = '(pointer: coarse) and (orientation: portrait) and (min-width: 600px)'
const KEY = 'maro-hado:rotate-hint-dismissed'

/** タブレットを縦向きで使っているときに「横向きがおすすめ」と知らせる */
export function RotateHint() {
  const [match, setMatch] = useState(() => {
    try {
      return window.matchMedia(QUERY).matches
    } catch {
      return false
    }
  })
  const [dismissed, setDismissed] = useState(() => {
    try {
      return sessionStorage.getItem(KEY) === '1'
    } catch {
      return false
    }
  })
  useEffect(() => {
    let mq: MediaQueryList
    try {
      mq = window.matchMedia(QUERY)
    } catch {
      return
    }
    const h = () => setMatch(mq.matches)
    mq.addEventListener('change', h)
    return () => mq.removeEventListener('change', h)
  }, [])
  if (!match || dismissed) return null
  const close = () => {
    setDismissed(true)
    try {
      sessionStorage.setItem(KEY, '1')
    } catch {
      /* 保存できなくても閉じる */
    }
  }
  return (
    <div className="fixed inset-0 z-[60] flex animate-fade items-center justify-center bg-black/45 p-6 backdrop-blur-[2px]" role="dialog" aria-label="横向きのおすすめ">
      <div className="w-full max-w-sm animate-pop rounded-none border-t-[6px] border-[#3d3b35] bg-[#eeebe1] p-6 text-center shadow-2xl">
        <div className="mx-auto mb-4 flex h-24 items-center justify-center gap-5">
          <img src={face} alt="" className="h-16 w-16 rounded-none border-2 border-[#3d3b35] object-cover" />
          <span aria-hidden className="block h-20 w-14 animate-[turn-device_2.6s_ease-in-out_infinite] rounded-none border-4 border-stone-700 bg-teal-board/80 shadow-md" />
        </div>
        <p className="text-lg font-black text-stone-900">タブレットは横向きがおすすめまろ！</p>
        <p className="mt-2 text-sm leading-relaxed text-stone-600">横にすると、盤面と城の上・手元が一度に見えて遊びやすくなります。</p>
        <button type="button" onClick={close} className="mt-5 w-full rounded-none border-2 border-stone-300 bg-white py-3 text-sm font-bold text-stone-600">
          このまま縦で使う
        </button>
      </div>
    </div>
  )
}
