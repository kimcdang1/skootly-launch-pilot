CREATE TABLE `launch_checkouts` (
	`id` varchar(36) NOT NULL,
	`packId` varchar(36) NOT NULL,
	`userId` int NOT NULL,
	`amount` int NOT NULL,
	`sessionId` varchar(255),
	`createdAt` bigint NOT NULL,
	CONSTRAINT `launch_checkouts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `launch_packs` (
	`id` varchar(36) NOT NULL,
	`ownerId` int NOT NULL,
	`name` varchar(150) NOT NULL,
	`coach` varchar(120) NOT NULL,
	`promise` text NOT NULL,
	`method` text NOT NULL,
	`communityUrl` varchar(2000) NOT NULL,
	`priceCents` int NOT NULL,
	`published` boolean NOT NULL DEFAULT false,
	`createdAt` bigint NOT NULL,
	CONSTRAINT `launch_packs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `launch_projects` (
	`id` varchar(36) NOT NULL,
	`packId` varchar(36) NOT NULL,
	`userId` int NOT NULL,
	`profile` json,
	`ideas` json,
	`selectedIdea` json,
	`website` json,
	`ctaUrl` varchar(2000),
	`publishedHtml` text,
	`generationCount` int NOT NULL DEFAULT 0,
	`revision` int NOT NULL DEFAULT 0,
	`createdAt` bigint NOT NULL,
	CONSTRAINT `launch_projects_id` PRIMARY KEY(`id`),
	CONSTRAINT `launch_project_user_pack_unique` UNIQUE(`userId`,`packId`)
);
--> statement-breakpoint
ALTER TABLE `launch_checkouts` ADD CONSTRAINT `launch_checkouts_packId_launch_packs_id_fk` FOREIGN KEY (`packId`) REFERENCES `launch_packs`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `launch_checkouts` ADD CONSTRAINT `launch_checkouts_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `launch_packs` ADD CONSTRAINT `launch_packs_ownerId_users_id_fk` FOREIGN KEY (`ownerId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `launch_projects` ADD CONSTRAINT `launch_projects_packId_launch_packs_id_fk` FOREIGN KEY (`packId`) REFERENCES `launch_packs`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `launch_projects` ADD CONSTRAINT `launch_projects_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `launch_checkout_recovery_idx` ON `launch_checkouts` (`userId`,`packId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `launch_pack_owner_idx` ON `launch_packs` (`ownerId`);