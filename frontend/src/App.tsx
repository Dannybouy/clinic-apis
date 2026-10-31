import { useState, type CSSProperties } from 'react'
import { Tabs as TabsPrimitive } from '@base-ui/react/tabs'
import { CalendarDaysIcon, ListChecksIcon } from 'lucide-react'
import { Header } from '@/components/Header'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { Toaster } from '@/components/ui/sonner'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { TooltipProvider } from '@/components/ui/tooltip'
import { MyBookings } from '@/features/bookings/MyBookings'
import { SlotBrowser } from '@/features/slots/SlotBrowser'
import { SlotsProvider } from '@/features/slots/SlotsProvider'
import { InspectorPanel } from '@/inspector/InspectorPanel'
import { useHashTab, type AppTab } from '@/hooks/useHashTab'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { timezoneLabel } from '@/lib/format'
import { cn } from '@/lib/utils'

export default function App() {
  const [tab, setTab] = useHashTab()
  const isDesktop = useMediaQuery('(min-width: 1024px)')
  const [desktopInspector, setDesktopInspector] = useState(true)
  const [mobileInspector, setMobileInspector] = useState(false)
  const inspectorOpen = isDesktop ? desktopInspector : mobileInspector

  function toggleInspector() {
    if (isDesktop) setDesktopInspector(open => !open)
    else setMobileInspector(open => !open)
  }

  return (
    <TooltipProvider delay={350}>
      <SlotsProvider>
        <div className="min-h-dvh">
          <Header inspectorOpen={inspectorOpen} onToggleInspector={toggleInspector} />

          <main className={cn('px-4 pt-10 pb-24 sm:px-6 lg:pt-14', isDesktop && desktopInspector && 'lg:pr-[calc(24rem+1.5rem)] xl:pr-[calc(28rem+2rem)]')}>
            <div className="mx-auto grid max-w-4xl gap-10">
              <Intro />

              <Tabs value={tab} onValueChange={value => setTab(value as AppTab)} className="gap-6">
                <TabsList variant="line" className="relative h-auto! w-full justify-start gap-6 rounded-none border-b p-0">
                  <TabsTrigger value="book" className="h-11 flex-none px-0 text-[15px] after:hidden">
                    <CalendarDaysIcon />
                    Find a slot
                  </TabsTrigger>
                  <TabsTrigger value="bookings" className="h-11 flex-none px-0 text-[15px] after:hidden">
                    <ListChecksIcon />
                    My bookings
                  </TabsTrigger>
                  <TabsPrimitive.Indicator className="absolute bottom-[-1px] left-0 h-0.5 w-(--active-tab-width) translate-x-(--active-tab-left) rounded-full bg-ink transition-[translate,width] duration-250 ease-in-out-strong" />
                </TabsList>
                <TabsContent value="book">
                  <SlotBrowser onViewBookings={() => setTab('bookings')} />
                </TabsContent>
                <TabsContent value="bookings">
                  <MyBookings onFindSlot={() => setTab('book')} />
                </TabsContent>
              </Tabs>
            </div>
          </main>

          {isDesktop ? (
            <aside
              aria-label="API inspector"
              aria-hidden={!desktopInspector}
              inert={!desktopInspector}
              className={cn(
                'fixed top-15 right-0 bottom-0 z-30 w-[24rem] xl:w-[28rem] border-l border-scope-line shadow-[-24px_0_48px_-32px_rgb(13_23_18/0.5)] transition-[translate,opacity] duration-300 ease-drawer',
                desktopInspector ? 'translate-x-0' : 'pointer-events-none translate-x-full opacity-0',
              )}
            >
              <InspectorPanel className="h-full" />
            </aside>
          ) : (
            <Sheet open={mobileInspector} onOpenChange={setMobileInspector}>
              <SheetContent
                side="bottom"
                showCloseButton={false}
                className="gap-0 data-[side=bottom]:h-[80dvh] overflow-hidden rounded-t-2xl border-scope-line bg-scope p-0 text-scope-text ease-drawer"
              >
                <SheetTitle className="sr-only">API inspector</SheetTitle>
                <InspectorPanel className="h-full" onClose={() => setMobileInspector(false)} />
              </SheetContent>
            </Sheet>
          )}
        </div>
        <Toaster theme="light" position="bottom-left" richColors={false} />
      </SlotsProvider>
    </TooltipProvider>
  )
}

function Intro() {
  return (
    <section className="grid gap-4">
      <p className="rise-in font-mono text-[11px] tracking-[0.18em] text-muted-foreground uppercase">
        Koya Clinic · Appointments
      </p>
      <h1 className="rise-in max-w-2xl font-display text-[44px] leading-[0.95] tracking-[-0.01em] text-balance sm:text-[64px]" style={{ '--i': 1 } as CSSProperties}>
        See a doctor <em className="text-green">this week.</em>
      </h1>
      <p className="rise-in max-w-xl text-[15px] leading-relaxed text-muted-foreground" style={{ '--i': 2 } as CSSProperties}>
        Pick a time and book in seconds. Times are shown in your timezone ({timezoneLabel()}). Every request this page
        makes appears in the API inspector, with its headers, timing and a copyable curl.
      </p>
    </section>
  )
}
