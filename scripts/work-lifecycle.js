#!/usr/bin/env node

'use strict';

require('../skills/work-lifecycle/scripts/work.js').main().catch((error) => {
  console.error(`Work lifecycle failed: ${error.message}`);
  process.exitCode = 1;
});
