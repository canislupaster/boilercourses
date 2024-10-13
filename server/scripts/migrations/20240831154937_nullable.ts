import type {Knex} from "knex";

export async function up(knex: Knex) {
		await knex.schema.createTable("course_post_copy", tb=>{
			tb.bigIncrements("id");
			tb.integer("course").references("course.id").notNullable().onDelete("CASCADE");

			tb.text("name");
			tb.integer("rating");
			tb.integer("votes").notNullable().defaultTo(0);
			tb.boolean("new").notNullable();
			tb.integer("user").references("user.id").notNullable().onDelete("CASCADE");

			tb.text("text");
			tb.timestamp("submitted").notNullable();
		});
		
		await knex.raw("INSERT INTO course_post_copy SELECT * FROM course_post;");

		await knex.schema.dropTable("course_post");
		await knex.schema.renameTable("course_post_copy", "course_post");
}

export async function down(knex: Knex) {
	await knex.schema.createTable("course_post_copy", tb=>{
		tb.bigIncrements("id");
		tb.integer("course").references("course.id").notNullable().onDelete("CASCADE");

		tb.text("name");
		tb.integer("rating");
		tb.integer("votes").notNullable().defaultTo(0);
		tb.boolean("new").notNullable();
		tb.integer("user").references("user.id").notNullable().onDelete("CASCADE");

		tb.text("text").notNullable();
		tb.timestamp("submitted").notNullable();
	});
	
	await knex.raw("INSERT INTO course_post_copy SELECT * FROM course_post WHERE text IS NOT NULL;");

	await knex.schema.dropTable("course_post");
	await knex.schema.renameTable("course_post_copy", "course_post");
}

