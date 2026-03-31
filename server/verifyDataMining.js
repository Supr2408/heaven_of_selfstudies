require('dotenv').config();
const mongoose = require('mongoose');
const Course = require('./src/models/Course');
const Week = require('./src/models/Week');
const YearInstance = require('./src/models/YearInstance');

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const course = await Course.findOne({ code: 'DATA MINING' });
  console.log('Course:', course?.title);
  
  const yi = await YearInstance.findOne({ courseId: course._id });
  console.log('YearInstance:', yi?.year, yi?.semester, 'Total weeks:', yi?.totalWeeks);
  
  const weeks = await Week.find({ yearInstanceId: yi._id }).sort({ weekNumber: 1 });
  console.log('\nWeeks created:');
  weeks.forEach(w => {
    console.log(`  Week ${w.weekNumber}: ${w.title} (${w.materials.length} materials)`);
    if (w.materials.length > 0) {
      w.materials.slice(0, 2).forEach(m => console.log(`    - ${m.title} (${m.type})`));
    }
  });
  
  await mongoose.disconnect();
})();
