const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const cors = require('cors');
const multer = require('multer');
const { config } = require('dotenv');
require('dotenv').config();


const app = express();
app.use(express.json());
const port = 8080;
app.use(cors());

// Connect to MongoDB
mongoose.connect(process.env.MONGODB, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// Define Storage for Multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/'); // Specify the directory to save uploaded files
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '_' + file.originalname); // Rename the file to avoid naming conflicts
  },
});

// Initialize Multer with the storage configuration
const upload = multer({ storage: storage });

// Define user schema
const userSchema = new mongoose.Schema({
  fullName: String,
  email: String,
  password: String,
  receiveEmails: Boolean,
});

const User = mongoose.model('User', userSchema);

// Define inventory schema
const inventorySchema = new mongoose.Schema({
  propertySpaceName: String,
  propertyInventoryType: String,
  otherPropertyType: String,
  capacity: String,
  amenities: String,
  availabilityStatus: {
    type: String,
  },
  notes: String,
  userId: String, // Changed from an array to a single string
  createdAt: {
    type: Date,
    default: new Date(),
  },
});

const Inventory = mongoose.model('Inventory', inventorySchema);

// Define business information schema
const propertyInformationSchema = new mongoose.Schema({
  propertyType: String,
  propertyName: String,
  phoneNumber: String,
  emailAddress: String,
  address: String,
  state: String,
  city: String,
  pinCode: String,
  logo:String,
  inventory: [inventorySchema], // Changed to an array of inventorySchema
  createdAt: {
    type: Date,
    default: new Date(),
  },
});

const PropertyInformation = mongoose.model(
  'PropertyInformation',
  propertyInformationSchema
);

// Middleware
app.use(bodyParser.json());

// Sign Up
app.post('/signup', async (req, res) => {
  try {
    const { fullName, email, password, confirmPassword, receiveEmails } = req.body;
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      console.log('User Already Exists!');
      return res
        .status(409)
        .json({ error: 'User Already Exists, go Signin Chief!' });
    }
    // Check if passwords match
    if (password !== confirmPassword) {
      return res.status(400).json({ error: 'Passwords do not match' });
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create a new user
    const user = new User({
      fullName,
      email,
      password: hashedPassword,
      receiveEmails,
    });

    // Save the user to the database
    await user.save();

    res.status(201).json({ message: 'User created successfully' });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Sign In
app.post('/signin', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user by email
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Check if the password is correct
    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Create and send JWT token
    const token = jwt.sign({ userId: user._id }, 'your-secret-key');
    res.status(201).json({ token, user });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Forgot Password
app.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    // Check if the user exists
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Generate and send reset token via email
    const resetToken = jwt.sign({ userId: user._id }, 'your-secret-key', {
      expiresIn: '1h',
    });

    // Setup nodemailer transporter
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: 'your-email@gmail.com',
        pass: 'your-email-password',
      },
    });

    // Send email with reset link
    const resetLink = `http://your-frontend-app/reset-password?token=${resetToken}`;
    const mailOptions = {
      from: 'your-email@gmail.com',
      to: user.email,
      subject: 'Password Reset',
      text: `Click the following link to reset your password: ${resetLink}`,
    };

    await transporter.sendMail(mailOptions);

    res.json({ message: 'Password reset link sent to your email' });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Property setup route
app.post('/property-setup', upload.single('logo'), async (req, res) => {
  try {

    // Extract data from the request
    const {
      propertyType,
      propertyName,
      phoneNumber,
      email,
      address,
      state,
      city,
      pinCode,
      inventory,
    } = req.body;

    // Process uploaded image (you can save it to a storage service or server)
    const logo = req.file; // logo will be available as req.file.buffer

    // Create a new property information document
    const propertyInfo = new PropertyInformation({
      propertyType,
      propertyName,
      phoneNumber,
      emailAddress: email,
      address,
      state,
      city,
      pinCode,
      inventory,
      logo: req.file.path, // Use the path of the uploaded image
    });
    

    // Save the property information to the database
    await propertyInfo.save();

    res.status(200).json({ message: 'Property information saved successfully' });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
