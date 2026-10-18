import horizontalDark from '../assets/images/logo-horizontal-dark.png'
import horizontalLight from '../assets/images/logo-horizontal-light.png'
import symbolDark from '../assets/images/logo-symbol-dark.png'
import symbolLight from '../assets/images/logo-symbol-light.png'

type LogoProps = {
  variant?: 'horizontal' | 'symbol'
  // Altura em pixels; a largura segue a proporção
  height?: number
  className?: string
}

const sources = {
  horizontal: { light: horizontalLight, dark: horizontalDark },
  symbol: { light: symbolLight, dark: symbolDark },
}

// A logo da marca: a versão clara aparece no tema claro e a versão em tons claros, no escuro.
// O nome vem uma vez (alt na primeira imagem); a outra fica oculta para leitores de tela.
export function Logo({ variant = 'horizontal', height = 32, className }: LogoProps) {
  const { light, dark } = sources[variant]
  return (
    <span className={className}>
      <img src={light} alt="Rota Certa" height={height} className="logo-for-light" style={{ height, width: 'auto' }} />
      <img src={dark} alt="Rota Certa" height={height} className="logo-for-dark" style={{ height, width: 'auto' }} />
    </span>
  )
}
