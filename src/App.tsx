import { useEffect, useMemo, useState } from 'react'
import { CircleSlash } from 'lucide-react'
import { Button } from './components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from './components/ui/card'

const STARTING_HERALDRY = 9
const MAX_CONQUEST = 1600
const MAX_BLOODY_TOKENS = 1600
const SLOT_CONFIG_STORAGE_KEY = 'pvp-slot-calc.slot-config.v1'

type Subtype = 'conquest' | 'bloody token' | 'heraldry' | 'none'

type SlotDefinition = {
  id: string
  label: string
  conquestCost: number
  heraldryCost: number | null
}

const createSlot = (
  id: string,
  label: string,
  heraldryCost: number | null,
  conquestOverride?: number,
): SlotDefinition => ({
  id,
  label,
  heraldryCost,
  conquestCost:
    conquestOverride ?? (heraldryCost === null ? 0 : heraldryCost * 175),
})

const subtypes = [
  { key: 'conquest', label: 'Conquest', image: '/conquest.jpg' as const },
  {
    key: 'bloody token',
    label: 'Bloody Token',
    image: '/bloodytoken.jpg' as const,
  },
  { key: 'heraldry', label: 'Heraldry', image: '/heraldry.jpg' as const },
  { key: 'none', label: 'None', image: null },
] as const

const leftColumnEntries = [
  { type: 'slot', slot: createSlot('head', 'Head', 5) },
  { type: 'slot', slot: createSlot('neck', 'Neck', 3) },
  { type: 'slot', slot: createSlot('shoulder', 'Shoulder', 4) },
  { type: 'slot', slot: createSlot('back', 'Back', 3) },
  { type: 'slot', slot: createSlot('chest', 'Chest', 5) },
  { type: 'blank', label: 'Shirt' },
  { type: 'blank', label: 'Tabard' },
  { type: 'slot', slot: createSlot('wrist', 'Wrist', 3) },
] as const

const rightColumnSlots = [
  createSlot('hands', 'Hands', 4),
  createSlot('waist', 'Waist', 4),
  createSlot('legs', 'Legs', 5),
  createSlot('feet', 'Feet', 4),
  createSlot('finger-1', 'Finger 1', 3),
  createSlot('finger-2', 'Finger 2', 3),
  createSlot('trinket-1', 'Trinket 1', null, 700),
  createSlot('trinket-2', 'Trinket 2', null, 700),
]

const weaponSlots = [
  createSlot('weapon-two-handed', 'Two-Handed Weapon', 10),
  createSlot('weapon-one-handed-sa', '1H Strength/Agility Weapon', 5),
  createSlot('weapon-one-handed-int', '1H Intellect Weapon', 7),
  createSlot('weapon-off-hand', 'Off-hand / Shield', 3),
]

const allSlots = [
  ...leftColumnEntries.filter((entry) => entry.type === 'slot').map((entry) => entry.slot),
  ...rightColumnSlots,
  ...weaponSlots,
]

type SlotConfig = Record<string, Subtype>

const VALID_SUBTYPES: Subtype[] = ['conquest', 'bloody token', 'heraldry', 'none']

const createDefaultSlotConfig = (): SlotConfig =>
  allSlots.reduce<SlotConfig>((accumulator, slot) => {
    accumulator[slot.id] = 'none'
    return accumulator
  }, {})

const sanitizeStoredSlotConfig = (value: unknown): SlotConfig | null => {
  if (!value || typeof value !== 'object') {
    return null
  }

  const stored = value as Record<string, unknown>
  const defaults = createDefaultSlotConfig()

  for (const slot of allSlots) {
    const selectedSubtype = stored[slot.id]

    if (
      typeof selectedSubtype === 'string' &&
      VALID_SUBTYPES.includes(selectedSubtype as Subtype)
    ) {
      defaults[slot.id] = selectedSubtype as Subtype
    }
  }

  return defaults
}

function App() {
  const [slotConfig, setSlotConfig] = useState<SlotConfig>(() => {
    const defaults = createDefaultSlotConfig()

    if (typeof window === 'undefined') {
      return defaults
    }

    try {
      const raw = window.localStorage.getItem(SLOT_CONFIG_STORAGE_KEY)

      if (!raw) {
        return defaults
      }

      const parsed = JSON.parse(raw) as unknown
      return sanitizeStoredSlotConfig(parsed) ?? defaults
    } catch {
      return defaults
    }
  })

  useEffect(() => {
    try {
      window.localStorage.setItem(
        SLOT_CONFIG_STORAGE_KEY,
        JSON.stringify(slotConfig),
      )
    // eslint-disable-next-line no-empty
    } catch {}
  }, [slotConfig])

  const resourceTotals = useMemo(() => {
    let conquestSpent = 0
    let bloodySpent = 0
    let heraldryNeeded = 0
    const invalidHeraldrySlots: string[] = []

    for (const slot of allSlots) {
      const subtype = slotConfig[slot.id]

      if (subtype === 'conquest') {
        conquestSpent += slot.conquestCost
      }

      if (subtype === 'bloody token') {
        bloodySpent += slot.conquestCost
      }

      if (subtype === 'heraldry') {
        if (slot.heraldryCost === null) {
          invalidHeraldrySlots.push(slot.label)
        } else {
          heraldryNeeded += slot.heraldryCost
        }
      }
    }

    const convertedHeraldry = Math.max(0, heraldryNeeded - STARTING_HERALDRY)
    const conquestUsedForConversion = convertedHeraldry * 175
    const totalConquestRequired = conquestSpent + conquestUsedForConversion

    return {
      conquestSpent,
      bloodySpent,
      heraldryNeeded,
      convertedHeraldry,
      conquestUsedForConversion,
      totalConquestRequired,
      conquestOverCap: totalConquestRequired > MAX_CONQUEST,
      bloodyOverCap: bloodySpent > MAX_BLOODY_TOKENS,
      invalidHeraldrySlots,
    }
  }, [slotConfig])

  const setSlotSubtype = (slotId: string, subtype: Subtype) => {
    setSlotConfig((current) => ({
      ...current,
      [slotId]: current[slotId] === subtype ? 'none' : subtype,
    }))
  }

  const renderSlotCard = (slot: SlotDefinition) => {
    const currentSubtype = slotConfig[slot.id]

    return (
      <Card key={slot.id} className="w-fit">
        <CardHeader className="p-3 pb-2">
          <CardTitle className="text-sm">{slot.label}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 p-3 pt-0">
          <div className="flex items-center gap-2">
            {subtypes.map((entry) => {
              const isSelected = currentSubtype === entry.key
              const isHeraldryDisabled =
                entry.key === 'heraldry' && slot.heraldryCost === null

              return (
                <Button
                  key={entry.key}
                  type="button"
                  variant={isSelected ? 'default' : 'outline'}
                  className="group relative h-10 w-10 p-0"
                  onClick={() => setSlotSubtype(slot.id, entry.key)}
                  title={
                    isHeraldryDisabled
                      ? `${entry.label} (not available for ${slot.label})`
                      : entry.label
                  }
                  disabled={isHeraldryDisabled}
                >
                  {entry.image ? (
                    <img
                      src={entry.image}
                      alt={entry.label}
                      className="h-7 w-7 rounded object-cover"
                    />
                  ) : (
                    <CircleSlash className="h-4 w-4" />
                  )}
                  <span className="pointer-events-none absolute -bottom-8 left-1/2 z-20 -translate-x-1/2 rounded border bg-popover px-2 py-1 text-xs text-popover-foreground opacity-0 shadow transition-opacity group-hover:opacity-100">
                    {entry.label}
                  </span>
                </Button>
              )
            })}
          </div>
        </CardContent>
      </Card>
    )
  }

  const renderBlankCard = (label: string) => {
    return (
      <Card
        key={label}
        className="h-[92px] w-[208px] border-dashed bg-muted/20 opacity-70"
      >
        <CardContent className="p-0" />
      </Card>
    )
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-background p-6">
      <div
        className="pointer-events-none absolute inset-0 bg-cover bg-center blur-sm"
        style={{ backgroundImage: "url('/bg.jpg')" }}
      />
      <div className="pointer-events-none absolute inset-0 bg-background/70" />

      <Card className="relative z-10 mx-auto w-full max-w-7xl backdrop-blur-sm">
        <CardHeader>
          <CardTitle>Midnight S1 Heroic Week PvP Slot Calculator</CardTitle>
          <CardDescription>
            Select a type of currency you can use to craft items and see how many resources you'll need in total, including any conversions.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid justify-center gap-6 lg:grid-cols-[auto_minmax(520px,1fr)_auto]">
            <div className="space-y-3">
              {leftColumnEntries.map((entry) =>
                entry.type === 'slot'
                  ? renderSlotCard(entry.slot)
                  : renderBlankCard(entry.label),
              )}
            </div>

            <Card className="hidden lg:block lg:min-h-[520px]">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-base">Your Currency Totals</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col justify-start gap-4 p-5 pt-0">
                <div
                  className={`rounded-md border px-4 py-4 text-base ${
                    resourceTotals.conquestOverCap
                      ? 'border-destructive bg-destructive/10 text-destructive'
                      : 'bg-muted/30'
                  }`}
                >
                  <p className="text-sm text-muted-foreground">Conquest</p>
                  <p className="text-lg font-semibold">
                    {resourceTotals.totalConquestRequired} / {MAX_CONQUEST}
                  </p>
                  <p className="text-sm">
                    Base: {resourceTotals.conquestSpent} + Conversion:{' '}
                    {resourceTotals.conquestUsedForConversion}
                  </p>
                </div>

                <div
                  className={`rounded-md border px-4 py-4 text-base ${
                    resourceTotals.bloodyOverCap
                      ? 'border-destructive bg-destructive/10 text-destructive'
                      : 'bg-muted/30'
                  }`}
                >
                  <p className="text-sm text-muted-foreground">Bloody Tokens</p>
                  <p className="text-lg font-semibold">
                    {resourceTotals.bloodySpent} / {MAX_BLOODY_TOKENS}
                  </p>
                </div>

                <div className="rounded-md border bg-muted/30 px-4 py-4 text-base">
                  <p className="text-sm text-muted-foreground">Heraldry & Conversion</p>
                  <div className="mt-2 space-y-2">
                    <div className="rounded bg-background/20 px-3 py-2">
                      <p className="text-sm text-muted-foreground">Heraldry Needed</p>
                      <p className="text-lg font-semibold">
                        {resourceTotals.heraldryNeeded} (start with {STARTING_HERALDRY})
                      </p>
                    </div>
                    <div className="rounded bg-background/20 px-3 py-2">
                      <p className="text-sm text-muted-foreground">Conquest → Heraldry</p>
                      <p className="text-lg font-semibold">
                        {resourceTotals.convertedHeraldry} heraldry
                      </p>
                      <p className="text-sm">
                        Costs {resourceTotals.conquestUsedForConversion} conquest
                      </p>
                    </div>
                  </div>
                  {resourceTotals.invalidHeraldrySlots.length > 0 ? (
                    <p className="mt-2 text-sm text-destructive">
                      Not eligible: {resourceTotals.invalidHeraldrySlots.join(', ')}
                    </p>
                  ) : null}
                </div>

                <div className="rounded-md border bg-muted/30 px-4 py-4 text-base">
                  <p className="text-sm text-muted-foreground">Item Level Quick Reference</p>
                  <div className="mt-2 space-y-2">
                    <div className="flex items-center gap-3 rounded bg-background/20 px-3 py-2">
                      <img
                        src="/conquest.jpg"
                        alt="Conquest"
                        className="h-6 w-6 rounded object-cover"
                      />
                      <div>
                        <p className="text-sm font-semibold">Conquest</p>
                        <p className="text-sm text-muted-foreground">246 • Champion 1/6</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 rounded bg-background/20 px-3 py-2">
                      <img
                        src="/bloodytoken.jpg"
                        alt="Bloody Token"
                        className="h-6 w-6 rounded object-cover"
                      />
                      <div>
                        <p className="text-sm font-semibold">Bloody Token</p>
                        <p className="text-sm text-muted-foreground">243 • Veteran 4/6</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 rounded bg-background/20 px-3 py-2">
                      <img
                        src="/heraldry.jpg"
                        alt="Heraldry"
                        className="h-6 w-6 rounded object-cover"
                      />
                      <div>
                        <p className="text-sm font-semibold">Heraldry</p>
                        <p className="text-sm text-muted-foreground">246 • Non-upgradable</p>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-3">{rightColumnSlots.map(renderSlotCard)}</div>
          </div>

          <div>
            <p className="mb-2 text-sm font-medium text-muted-foreground">Weapons</p>
            <div className="mx-auto flex w-fit items-start justify-center gap-3">
              {weaponSlots.map(renderSlotCard)}
            </div>
          </div>
        </CardContent>
      </Card>
    </main>
  )
}

export default App
