const { _electron: electron } = require('@playwright/test');
const { test, expect } = require('@playwright/test');
const path = require('path');

test.describe('LibPass Complete Ecosystem E2E System Test Suite', () => {
  let electronApp;
  let window;

  test.beforeAll(async () => {
    // Launch the Electron App shell
    electronApp = await electron.launch({ args: ['.'] });
    window = await electronApp.firstWindow();
    await window.waitForLoadState('domcontentloaded');
  });

  test.afterAll(async () => {
    // Shutdown the app shell when complete
    await electronApp.close();
  });


  // PHASE 1: TESTING THE REGISTRATION INTERFACE
  // ==========================================
  test('Phase 1: Should navigate to and submit the Registration Form', async () => {
    // Force window to load the registration page
    await window.goto(`file://${path.resolve(__dirname, '../index.html')}`);
    await window.waitForLoadState('domcontentloaded');

    // 1. Verify page identity
    const heading = window.locator('h2');
    await expect(heading).toContainText('Registration Form');

    // 2. Select category dropdown
    const category = window.locator('#visitor-type');
    await category.selectOption('student');

    // 3. Populate form input parameters
    await window.locator('#user-id').fill('LP-2026-TEST');
    await window.locator('#user-name').fill('Automated Test Student');
    await window.locator('#user-dept').fill('Computer Science');
    await window.locator('#user-level').selectOption('400');
    await window.locator('#user-gender').selectOption('M');
    await window.locator('#user-phone').fill('0501234567');
    await window.locator('#user-email').fill('test@libpass.edu.gh');

    // 4. Accept data safety terms conditions
    const consentCheckbox = window.locator('#consent-checkbox');
    await consentCheckbox.check();
    await expect(consentCheckbox).toBeChecked();

    // 5. Verify camera controls are interactive
    const cameraBtn = window.locator('#start-camera-btn');
    await expect(cameraBtn).toBeVisible();
  });


  // PHASE 2: TESTING THE BIOMETRIC SCANNER PORTAL

  test('Phase 2: Should verify Camera and QR Scanner toggles', async () => {
    // Force window to load the scanner station page
    await window.goto(`file://${path.resolve(__dirname, '../scan.html')}`);
    await window.waitForLoadState('domcontentloaded');

    // 1. Verify primary camera components load
    const faceContainer = window.locator('#face-scanner-container');
    await expect(faceContainer).toBeVisible();

    // 2. Click to toggle over to QR mode
    const switchToQrBtn = window.locator('#btn-switch-to-qr');
    await switchToQrBtn.click();

    // 3. Verify QR scanner canvas container displays and face container hides
    const qrContainer = window.locator('#qr-scanner-container');
    await expect(qrContainer).toBeVisible();
    await expect(faceContainer).not.toBeVisible();

    // 4. Click to toggle back to Face mode
    const switchToFaceBtn = window.locator('#btn-switch-to-face');
    await switchToFaceBtn.click();
    await expect(faceContainer).toBeVisible();
  });


  // PHASE 3: TESTING THE VISITOR ANALYTICS DASHBOARD

  test('Phase 3: Should review visitor lookup pipelines and analytics controls', async () => {
    // Force window to load the management dashboard view
    await window.goto(`file://${path.resolve(__dirname, '../dashboard.html')}`);
    await window.waitForLoadState('domcontentloaded');

    // 1. Check if metrics scorecards are responsive
    const metricsFilter = window.locator('#metrics-filter');
    await expect(metricsFilter).toBeVisible();
    await metricsFilter.selectOption('this_month');

    // 2. Perform custom history lookups
    const searchDropdown = window.locator('#search-type');
    await searchDropdown.selectOption('students');
    await window.locator('#search-input').fill('Automated');
    
    // 3. Fire request to database
    await window.locator('#search-button').click();

    // 4. Verify system rendering blocks
    const resultsBody = window.locator('#search-results-body');
    await expect(resultsBody).toBeVisible();
    
    // 5. Ensure control commands like "Deactivate Completed Students" exist
    const cleanupBtn = window.locator('#deactivate-completed-btn');
    await expect(cleanupBtn).toBeVisible();
  });
});