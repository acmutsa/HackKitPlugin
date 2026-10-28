import { Migration } from "@mikro-orm/migrations";

export class Migration20261028120000_user_image extends Migration {
	override name = "Migration20261028120000_user_image";

	override up(): void {
		this.addSql("alter table `core_user` rename column `profile_photo_url` to `image`;");
	}

	override down(): void {
		this.addSql("alter table `core_user` rename column `image` to `profile_photo_url`;");
	}
}
