import asyncHandler from 'express-async-handler';
import User from '../models/userModel.js';
import Group from '../models/groupModel.js';
import Post from '../models/postsModel.js';
import uploadImageToStorage from '../utils/fileUpload.js';

// Folder path for group icon and cover photos
const ASSETS_FOLDER = "group-assets/";
const GROUP_POSTS_FOLDER = "group-posts/"

/* Creating a new group and adding the admin to the members array. */
const createGroup = asyncHandler(async (req,res)=> {

    const { name, description, group_privacy } = req.body;
    const user = await User.findById(req.user._id);
    const icon = req.file;
    const coverPhoto = req.file;    
    if(!user){
        res.status(400)
        throw new Error("User no found !!");
    }
    
    let group = new Group({
        name,
        description,
        group_admin_id: user._id,
        group_privacy
    })

    if(icon){
        uploadImageToStorage(file,ASSETS_FOLDER)
        .then((url) => {
        //   group.group_icon = url  
        group = {
            ...group,
            group_icon: url
        }
         
        })
        .catch((error) => {
          return res.status(500).send({
            error: error
          });
        });
    }

    // if(coverPhoto){
    //     uploadImageToStorage(file,folderPathToAssets)
    //     .then((url) => {
    //       group.group_icon = url  
         
    //     })
    //     .catch((error) => {
    //       return res.status(500).send({
    //         error: error
    //       });
    //     });
    // }

    group.members.push({
        _id: user._id,
        name: `${user.firstName} ${user.lastName}`,
        isAdmin: true,
    });
    await group.save();

    res.send({
        ...group._doc,
        groupMembers: group.groupMembers.length,
        posts: group.posts.length,
    });

    // res.status(201).send("Group created successfully");

})

const createPostByGroupId = asyncHandler(async(req,res)=>{

    const user = await User.findById(req.user._id).select('_id firstName lastName profilePicture');
    const groupId = req.params.id;
    const group = await Group.findById(groupId);

    if(!group || !user){
        res.status(400);
        throw new Error("User or group not found!!");
    }

    const {title, description} = req.body;
    let post = {
        group_Id: groupId,
        author_name: `${user.firstName} ${user.lastName}`,
        title,
        description,
        author_id: user._id,
        author_profile: user.profilePicture
    }

    if (req.files) {
        const { data, mimetype } = req.files.file;
        post = {
          ...post,
          image: { data, contentType: mimetype },
          hasImage: true,
        };
    }
    post = new Post(post);
    await post.save();
    post = await Post.findById({ _id: post._id })
    .populate("author_id", "_id firstName lastName");

    group.posts.push({
        _id: post._id
    })

    await group.save();

    res.send({
        ...post._doc,
        likes: post.likes.length,
        comments: post.comments.length,
    });
    
})

const joinGroup = asyncHandler( async(req,res)=>{
    const user = await User.findById(req.user._id);
    const groupId = req.params.id;
    const group = await Group.findById(groupId);
    
    if(!group){
        res.status(400);
        throw new Error("Group not found !!!")
    }
    if(!user){
        res.status(400);
        throw new Error("User not found")   
    }
    if(group.group_admin_id === user._id){
        res.status(400)
        throw new Error("You are the Admin !!!")

    }
    const alreadyMember = group.members.find((member) => {
        return member._id.toString() === req.user._id.toString()
    });   

    if(alreadyMember){
        res.status(400)
        throw new Error('Already a Member')
    }

    if(!alreadyMember){
        group.members.push({
            _id: user._id,
            name: `${user.firstName} ${user.lastName}`
        })
    
        await group.save();

        user.groups_joined.push({
            _id: group._id, 
            group_name: group.name
        })
    
        await user.save();
    
        res.send(group.members)
    }
})

/* A middleware function that is used to edit the group details. */
const editGroupDetails = asyncHandler(async(req,res)=>{
    const user  = await User.findById(req.user._id);
    const groupId = req.params.id;
    const group = await Group.findById(groupId).select('_id');

    group.name = req.body.name;
    group.description = req.body.description;
    group.group_privacy = req.body.group_privacy;

    await group.save();
    res.status(200).send("Group details updated successfully");

})

/* This is a middleware function that is used to delete a group. */
const deleteGroup = asyncHandler(async(req,res)=>{
    const groupId  = req.params.id;
    await Group.findByIdAndRemove({ _id: groupId });
    res.status(200).send("Group deleted successfully");
    
})

/* This is a middleware function that is used to query the posts of a group. */
const queryGroupPosts = asyncHandler(async(req,res)=>{
    const groupId = req.params.id;
    try{
        const groupPosts = await Post.find({group_Id: groupId})
        .sort({ date: -1})
        .select("-date")
        res.status(200).send(groupPosts);
    }
    catch(error){
        res.status(400).send(error);
    }
         
})

/* This is a middleware function that is used to delete a group. */
const userLeaveGroup = asyncHandler(async(req,res)=>{
    const groupId = req.params.id;
    const user = await User.findById(req.user._id);
    await Group.findByIdAndUpdate(
        {_id: groupId},
        {
            $pull: {
              members: { _id: user._id, isAdmin: false }
            }

        }

    )
    res.status(200).send('You have left the group')
})

/* This is a middleware function that is used to query the members of a group. */
const groupMembers = asyncHandler(async(req,res)=>{
    const groupId = req.params.id;
    try{
        const members = await Group.findById(groupId).select('members');
        res.status(200).send(members)
    }
    catch(error){
        res.status(404).send(error)
    }
})


const queryAllGroups = asyncHandler(async(req,res)=>{
    await Group.find()
    .select('name description group_privacy group_icon')
    .exec()
    .then(groups => {
        res.json({groups})
    })
    .catch(err => console.log(err));
})

export {
    createGroup, 
    createPostByGroupId, 
    joinGroup,
    deleteGroup, 
    editGroupDetails,
    queryGroupPosts,
    userLeaveGroup,
    groupMembers,
    queryAllGroups
};
