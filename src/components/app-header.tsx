import { Avatar } from "@/components/avatar";
import { Brand } from "@/components/brand";
import { LogoutButton } from "@/components/logout-button";

export function AppHeader({ user }: { user: { id: string; name: string } }) {
  return (
    <header className="border-b bg-background">
      <div className="mx-auto flex w-full max-w-4xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <Brand />
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Avatar name={user.name} id={user.id} />
            <span className="hidden text-sm font-medium sm:inline">{user.name}</span>
          </div>
          <LogoutButton />
        </div>
      </div>
    </header>
  );
}
