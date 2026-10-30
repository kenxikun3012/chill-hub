-- The account now exists before sign-up step 3 collects the student ID number.
ALTER TABLE "users" ALTER COLUMN "student_id_number" DROP NOT NULL;
