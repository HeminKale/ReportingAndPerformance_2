"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/lib/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import { Bell, CheckCheck, Trash2 } from "lucide-react";
import type { Notification, User } from "@/lib/types/database";
import Link from "next/link";

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const { toast } = useToast();
  const supabase = createClient();

  useEffect(() => {
    fetchNotifications();

    const channel = supabase
      .channel('notifications-page')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
        },
        () => {
          fetchNotifications();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchNotifications = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) return;

    const { data: userData } = await supabase
      .from("users")
      .select("*")
      .eq("id", user.id)
      .single();

    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);

    setCurrentUser(userData || null);
    setNotifications(data || []);
    setLoading(false);
  };

  const isManagerApprover = currentUser?.role === "manager" || currentUser?.role === "admin";

  const isActionableNotification = (notification: Notification) => {
    const metadata = notification.metadata || {};
    return Boolean(
      isManagerApprover &&
      metadata.actionable === true &&
      metadata.resource_type &&
      metadata.resource_id
    );
  };

  const handleNotificationApproval = async (
    notification: Notification,
    action: "approve" | "reject"
  ) => {
    const metadata = notification.metadata || {};
    const resourceType = metadata.resource_type;
    const resourceId = metadata.resource_id;
    if (!resourceType || !resourceId || !currentUser) return;

    setActionLoadingId(notification.id);
    try {
      if (resourceType === "task_log") {
        const { error } = await supabase
          .from("task_logs")
          .update({
            verification_status: action === "approve" ? "approved" : "rejected",
            verified_by: currentUser.id,
            verified_at: new Date().toISOString(),
          })
          .eq("id", resourceId);
        if (error) throw error;
      }

      if (resourceType === "attendance") {
        const { error } = await supabase
          .from("attendance")
          .update({
            approval_status: action === "approve" ? "approved" : "rejected",
            approved_by: currentUser.id,
          })
          .eq("id", resourceId);
        if (error) throw error;
      }

      if (resourceType === "leave") {
        const { error } = await supabase
          .from("leaves")
          .update({
            status: action === "approve" ? "approved" : "rejected",
            approved_by: currentUser.id,
          })
          .eq("id", resourceId);
        if (error) throw error;
      }

      // Mark actionable notification as actioned and read.
      // We avoid delete because some environments may not allow notification deletes via RLS.
      const { error: notificationUpdateError } = await supabase
        .from("notifications")
        .update({
          is_read: true,
          metadata: {
            ...(notification.metadata || {}),
            actionable: false,
            actioned: true,
            action_taken: action,
            actioned_at: new Date().toISOString(),
          },
        })
        .eq("id", notification.id);
      if (notificationUpdateError) throw notificationUpdateError;

      toast({
        title: "Success",
        description: `Request ${action === "approve" ? "approved" : "rejected"} successfully.`,
      });
      fetchNotifications();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setActionLoadingId(null);
    }
  };

  const markAsRead = async (id: string) => {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id);

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } else {
      fetchNotifications();
    }
  };

  const markAllAsRead = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) return;

    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', user.id)
      .eq('is_read', false);

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "All notifications marked as read",
      });
      fetchNotifications();
    }
  };

  const deleteNotification = async (id: string) => {
    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('id', id);

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } else {
      fetchNotifications();
    }
  };

  const getNotificationIcon = (type: string) => {
    return <Bell className="h-5 w-5" />;
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'task_rejected':
        return 'border-l-red-500';
      case 'leave_approval':
        return 'border-l-green-500';
      case 'late_request':
        return 'border-l-yellow-500';
      case 'task_verification':
        return 'border-l-blue-500';
      default:
        return 'border-l-gray-500';
    }
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  const unreadCount = notifications.filter(n => !n.is_read).length;
  const visibleNotifications = notifications.filter((notification) => {
    const metadata = notification.metadata || {};
    return metadata.actioned !== true;
  });

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Notifications</h1>
          <p className="text-muted-foreground">
            {unreadCount > 0 ? `${unreadCount} unread notification${unreadCount > 1 ? 's' : ''}` : 'All caught up!'}
          </p>
        </div>
        {unreadCount > 0 && (
          <Button onClick={markAllAsRead} variant="outline">
            <CheckCheck className="h-4 w-4 mr-2" />
            Mark all as read
          </Button>
        )}
      </div>

      <div className="space-y-4">
        {visibleNotifications.length > 0 ? (
          visibleNotifications.map((notification) => (
            <Card
              key={notification.id}
              className={`border-l-4 ${getNotificationColor(notification.type)} ${
                !notification.is_read ? 'bg-blue-50/50' : ''
              }`}
            >
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex gap-4 flex-1">
                    <div className="mt-1">
                      {getNotificationIcon(notification.type)}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold">{notification.title}</h3>
                        {!notification.is_read && (
                          <span className="h-2 w-2 rounded-full bg-blue-500" />
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">
                        {notification.message}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                      </p>
                      {isActionableNotification(notification) && (
                        <div className="mt-3 flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => handleNotificationApproval(notification, "approve")}
                            disabled={actionLoadingId === notification.id}
                          >
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleNotificationApproval(notification, "reject")}
                            disabled={actionLoadingId === notification.id}
                          >
                            Reject
                          </Button>
                        </div>
                      )}
                      {notification.link && (
                        <Link
                          href={notification.link}
                          className="text-sm text-primary hover:underline mt-2 inline-block"
                        >
                          View details
                        </Link>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {!notification.is_read && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => markAsRead(notification.id)}
                      >
                        <CheckCheck className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteNotification(notification.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card>
            <CardContent className="p-12 text-center">
              <Bell className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">No notifications</h3>
              <p className="text-sm text-muted-foreground">
                You're all caught up! Notifications will appear here.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
