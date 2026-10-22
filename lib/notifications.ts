export type WorkspaceNotification = {
 id:string;title:string;description:string;createdAt:string;type:'client'|'document'|'reminder'|'welcome';read:boolean;
 clientId?:string;wasteStream?:string;category?:string;
};
export type NotificationData={items:WorkspaceNotification[];unreadCount:number};
