import { expect, test } from '@playwright/test';
import { fitnessStrings } from '@/lib/strings/fitness';
import { signIn } from './session';

test('builds a program, trains it, and finds the logged weight prefilled in the next pass', async ({
  page,
  context,
}) => {
  const run = Date.now().toString(36);
  const programName = `Program ${run}`;
  const workoutName = `Day ${run}`;
  const exerciseName = `Press ${run}`;
  await signIn(context);

  await page.goto('/fitness-tracker');
  await page.getByRole('link', { name: fitnessStrings.home.programsLink }).click();
  await page.getByLabel(fitnessStrings.programs.nameLabel, { exact: true }).fill(programName);
  await page.getByLabel(fitnessStrings.programs.blocksLabel, { exact: true }).fill('1');
  await page.getByRole('button', { name: fitnessStrings.programs.create }).click();
  await expect(page.getByRole('heading', { level: 1, name: programName })).toBeVisible();

  await page.getByRole('link', { name: fitnessStrings.programEdit.addWorkout }).click();
  await expect(
    page.getByRole('heading', { level: 1, name: fitnessStrings.workoutEdit.newTitle }),
  ).toBeVisible();
  await page.getByLabel(fitnessStrings.workoutEdit.nameLabel, { exact: true }).fill(workoutName);
  await page.getByRole('button', { name: fitnessStrings.workoutEdit.create }).click();
  await expect(page.getByRole('heading', { level: 1, name: workoutName })).toBeVisible();

  await page.getByRole('link', { name: fitnessStrings.workoutEdit.addExercise }).click();
  await expect(
    page.getByRole('heading', { level: 1, name: fitnessStrings.workoutEdit.addExercise }),
  ).toBeVisible();
  await page
    .getByLabel(fitnessStrings.workoutEdit.exerciseLabel, { exact: true })
    .selectOption({ label: fitnessStrings.workoutEdit.newExerciseOption });
  await page.getByLabel(fitnessStrings.workoutEdit.newExerciseNameLabel).fill(exerciseName);
  await page.getByLabel(fitnessStrings.workoutEdit.setsLabel, { exact: true }).fill('1');
  await page.getByLabel(fitnessStrings.workoutEdit.repsLabel, { exact: true }).fill('5');
  await page.getByRole('button', { name: fitnessStrings.workoutEdit.save }).click();
  await expect(page.getByRole('heading', { level: 1, name: workoutName })).toBeVisible();
  await expect(page.getByRole('listitem').filter({ hasText: exerciseName })).toContainText('1×5');

  await page.getByRole('link', { name: fitnessStrings.navigation.toProgram }).click();
  await page.getByRole('button', { name: fitnessStrings.programEdit.activate }).click();
  const confirmActivation = page
    .getByRole('dialog')
    .getByRole('button', { name: fitnessStrings.programEdit.activateConfirmLabel });
  if (await confirmActivation.isVisible()) {
    await confirmActivation.click();
  }
  await expect(page.getByText(fitnessStrings.programEdit.active, { exact: true })).toBeVisible();

  await page.goto('/fitness-tracker');
  await page.getByRole('link', { name: new RegExp(programName) }).click();
  await expect(page).toHaveURL('/fitness-tracker/active');
  await page.getByRole('link', { name: new RegExp(fitnessStrings.block.name(1)) }).click();
  await page.getByRole('button', { name: new RegExp(workoutName) }).click();
  await expect(
    page.getByRole('heading', { level: 1, name: new RegExp(workoutName) }),
  ).toBeVisible();

  await page.getByRole('textbox', { name: fitnessStrings.session.weightLabel(1) }).fill('42,5');
  await page.getByRole('button', { name: fitnessStrings.session.logLabel(1) }).click();
  await expect(page.getByText(fitnessStrings.session.loggedLabel(1))).toBeVisible();
  await expect(page.getByText('42.5')).toBeVisible();

  await page.getByRole('button', { name: fitnessStrings.session.finishWorkout }).click();
  await expect(page.getByText(fitnessStrings.block.programComplete)).toBeVisible();

  await page.getByRole('button', { name: new RegExp(workoutName) }).click();
  await expect(
    page.getByRole('textbox', { name: fitnessStrings.session.weightLabel(1) }),
  ).toHaveAttribute('placeholder', '42.5');
});
