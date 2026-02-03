'use client';

import { useAuth } from '@/hooks/use-auth';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

export default function SettingsPage() {
  const { user, isLoading } = useAuth();

  if (isLoading || !user) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Profile Settings</h1>
        <p className="text-gray-600">Manage your personal information</p>
      </div>

      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Personal Information</h3>
        <div className="space-y-4">
          <div>
            <Label htmlFor="name">Name</Label>
            <Input id="name" defaultValue={user.name} />
          </div>

          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" value={user.email} disabled />
            <p className="text-xs text-gray-500 mt-1">
              Email cannot be changed
            </p>
          </div>

          <Button disabled>Save Changes (Coming Soon)</Button>
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Company Information</h3>
        <div className="space-y-4">
          <div>
            <Label htmlFor="company">Company Name</Label>
            <Input id="company" defaultValue={user.company.name} />
          </div>

          <div>
            <Label htmlFor="industry">Industry</Label>
            <Input id="industry" defaultValue={user.company.industry} />
          </div>

          <Button disabled>Save Changes (Coming Soon)</Button>
        </div>
      </Card>
    </div>
  );
}
