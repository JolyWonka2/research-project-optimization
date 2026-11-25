import express from 'express';
import cors from 'cors';
import {calculatePortfolio,buildMarkdown} from './algorithms.js';
const app=express(); app.use(cors()); app.use(express.json({limit:'2mb'}));
app.get('/api/health',(_,res)=>res.json({status:'ok'}));
app.post('/api/optimize',(req,res)=>{try{res.json(calculatePortfolio(req.body));}catch(e){res.status(400).json({error:e.message});}});
app.post('/api/export',(req,res)=>{try{const md=buildMarkdown(req.body.payload,req.body.result);res.json({markdown:md});}catch(e){res.status(400).json({error:e.message});}});
const PORT=process.env.PORT||5000; app.listen(PORT,()=>console.log(`Server running on http://localhost:${PORT}`));
