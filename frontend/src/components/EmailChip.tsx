import { useState, type FormEvent } from 'react'
import { AtSignIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useRememberedEmail } from '@/hooks/useRememberedEmail'

export function EmailChip() {
  const [email, setEmail] = useRememberedEmail()
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(email)

  function onOpenChange(next: boolean) {
    if (next) setDraft(email)
    setOpen(next)
  }

  function save(event: FormEvent) {
    event.preventDefault()
    setEmail(draft)
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger
        render={
          <button
            type="button"
            className="inline-flex h-8 max-w-56 items-center gap-1.5 rounded-full border bg-card/70 pr-1 pl-2.5 text-[12.5px] transition-[background-color,border-color,scale] duration-150 ease-out hover:border-foreground/25 hover:bg-card focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none active:scale-[0.97]"
          />
        }
      >
        <AtSignIcon className="size-3.5 shrink-0 text-muted-foreground" />
        <span className={email ? 'truncate' : 'text-muted-foreground'}>{email || 'No email set'}</span>
        <span className="rounded-full bg-paper-deep px-2 py-0.5 text-[11px] font-medium text-foreground/70">
          {email ? 'Switch' : 'Set'}
        </span>
      </DialogTrigger>
      <DialogContent className="gap-5 p-6 sm:max-w-sm">
        <form onSubmit={save} className="grid gap-5">
          <DialogHeader>
            <DialogTitle className="text-[26px] leading-tight">{email ? 'Switch email' : 'Set your email'}</DialogTitle>
            <DialogDescription>
              Used to prefill bookings and to list them under My bookings. Stored only in this browser.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-1.5">
            <Label htmlFor="chip-email">Email</Label>
            <Input
              id="chip-email"
              type="email"
              autoComplete="email"
              autoFocus
              placeholder="you@example.com"
              value={draft}
              onChange={event => setDraft(event.target.value)}
              className="h-10 bg-card"
            />
          </div>
          <DialogFooter className="-mx-6 -mb-6 px-6">
            {email && (
              <Button
                type="button"
                variant="ghost"
                className="sm:mr-auto"
                onClick={() => {
                  setEmail('')
                  setOpen(false)
                }}
              >
                Forget email
              </Button>
            )}
            <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
            <Button type="submit">Save</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
